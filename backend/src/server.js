import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import pg from 'pg';
import crypto from 'node:crypto';

const { Pool } = pg;
const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || 'local-demo-secret-change-me';
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://spendwise:local_only_change_me@localhost:5432/spendwise';
const pool = new Pool({ connectionString: DATABASE_URL });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

const categories = ['Food','Transport','Shopping','Bills','Education','Health','Entertainment','Housing','Travel','Salary','Other'];
const money = n => Math.round(Number(n) * 100) / 100;

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('income','expense')), amount NUMERIC(12,2) NOT NULL CHECK(amount > 0),
      category TEXT NOT NULL, merchant TEXT DEFAULT '', payment_method TEXT DEFAULT 'UPI',
      note TEXT DEFAULT '', transaction_date DATE NOT NULL, created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS budgets (
      id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL, monthly_limit NUMERIC(12,2) NOT NULL CHECK(monthly_limit > 0),
      UNIQUE(user_id, category)
    );
    CREATE TABLE IF NOT EXISTS goals (
      id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL, target_amount NUMERIC(12,2) NOT NULL CHECK(target_amount > 0),
      saved_amount NUMERIC(12,2) NOT NULL DEFAULT 0, target_date DATE
    );
    CREATE TABLE IF NOT EXISTS recurring_payments (
      id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL, amount NUMERIC(12,2) NOT NULL CHECK(amount > 0),
      category TEXT NOT NULL, next_due DATE NOT NULL, cadence TEXT NOT NULL DEFAULT 'monthly'
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY, user_id UUID, action TEXT NOT NULL, detail JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}
const id = () => crypto.randomUUID();
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req,res,next)).catch(next);
const auth = (req,res,next) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i,'');
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Authentication required' }); }
};
const audit = async (userId, action, detail={}) => {
  await pool.query('INSERT INTO audit_logs(id,user_id,action,detail) VALUES($1,$2,$3,$4)',[id(),userId,action,JSON.stringify(detail)]);
};

app.get('/health', asyncRoute(async (_req,res) => {
  await pool.query('SELECT 1');
  res.json({ status:'ok', service:'spendwise-api', database:'connected' });
}));
app.get('/api', (_req,res) => res.json({ name:'SpendWise AI API', version:'1.0.0', endpoints:['/api/auth/register','/api/auth/login','/api/transactions','/api/budgets','/api/goals','/api/insights','/api/reports/monthly'] }));

app.post('/api/auth/register', asyncRoute(async (req,res) => {
  const { name, email, password } = req.body || {};
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || typeof password !== 'string' || password.length < 8)
    return res.status(400).json({ error:'Name, valid email, and password (at least 8 characters) are required' });
  const userId=id(), hash=await bcrypt.hash(password, 10);
  try {
    await pool.query('INSERT INTO users(id,name,email,password_hash) VALUES($1,$2,$3,$4)',[userId,name.trim(),email.toLowerCase(),hash]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error:'Email already registered' });
    throw e;
  }
  const token=jwt.sign({ id:userId, email:email.toLowerCase(), name:name.trim() },JWT_SECRET,{expiresIn:'12h'});
  await audit(userId,'user.registered');
  res.status(201).json({ token, user:{id:userId,name:name.trim(),email:email.toLowerCase()} });
}));
app.post('/api/auth/login', asyncRoute(async (req,res) => {
  const { email, password }=req.body || {};
  const result=await pool.query('SELECT * FROM users WHERE email=$1',[String(email||'').toLowerCase()]);
  if (!result.rowCount || !await bcrypt.compare(password||'',result.rows[0].password_hash))
    return res.status(401).json({ error:'Invalid email or password' });
  const u=result.rows[0], token=jwt.sign({id:u.id,email:u.email,name:u.name},JWT_SECRET,{expiresIn:'12h'});
  res.json({token,user:{id:u.id,name:u.name,email:u.email}});
}));
app.get('/api/me',auth,(req,res)=>res.json({user:req.user}));

app.get('/api/transactions',auth,asyncRoute(async(req,res)=>{
  const { month, kind, category, q }=req.query;
  const conditions=['user_id=$1'], params=[req.user.id];
  if(kind && ['income','expense'].includes(kind)){params.push(kind);conditions.push(`kind=$${params.length}`);}
  if(category){params.push(category);conditions.push(`category=$${params.length}`);}
  if(month && /^\d{4}-\d{2}$/.test(month)){params.push(`${month}-01`);conditions.push(`transaction_date >= $${params.length}::date AND transaction_date < ($${params.length}::date + interval '1 month')`);}
  if(q){params.push(`%${q}%`);conditions.push(`(merchant ILIKE $${params.length} OR note ILIKE $${params.length})`);}
  const r=await pool.query(`SELECT * FROM transactions WHERE ${conditions.join(' AND ')} ORDER BY transaction_date DESC, created_at DESC LIMIT 500`,params);
  res.json({transactions:r.rows});
}));
app.post('/api/transactions',auth,asyncRoute(async(req,res)=>{
  const b=req.body||{};
  const amount=Number(b.amount);
  if(!['income','expense'].includes(b.kind) || !Number.isFinite(amount) || amount<=0 || amount>100000000 ||
     !categories.includes(b.category) || !/^\d{4}-\d{2}-\d{2}$/.test(b.transaction_date||''))
    return res.status(400).json({error:'Valid kind, positive amount, category, and YYYY-MM-DD date are required'});
  const row=(await pool.query(`INSERT INTO transactions(id,user_id,kind,amount,category,merchant,payment_method,note,transaction_date)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [id(),req.user.id,b.kind,money(amount),b.category,String(b.merchant||'').slice(0,120),String(b.payment_method||'UPI'),String(b.note||'').slice(0,500),b.transaction_date])).rows[0];
  await audit(req.user.id,'transaction.created',{transactionId:row.id,amount:row.amount,kind:row.kind});
  res.status(201).json({transaction:row});
}));
app.delete('/api/transactions/:id',auth,asyncRoute(async(req,res)=>{
  const r=await pool.query('DELETE FROM transactions WHERE id=$1 AND user_id=$2 RETURNING id',[req.params.id,req.user.id]);
  if(!r.rowCount)return res.status(404).json({error:'Transaction not found'});
  await audit(req.user.id,'transaction.deleted',{transactionId:req.params.id});
  res.json({deleted:true});
}));
app.get('/api/dashboard',auth,asyncRoute(async(req,res)=>{
  const summary=await pool.query(`SELECT
    COALESCE(SUM(amount) FILTER(WHERE kind='income'),0) income,
    COALESCE(SUM(amount) FILTER(WHERE kind='expense'),0) expenses,
    COUNT(*)::int transaction_count
    FROM transactions WHERE user_id=$1 AND date_trunc('month',transaction_date)=date_trunc('month',CURRENT_DATE)`,[req.user.id]);
  const cats=await pool.query(`SELECT category, SUM(amount)::numeric(12,2) total FROM transactions
    WHERE user_id=$1 AND kind='expense' AND date_trunc('month',transaction_date)=date_trunc('month',CURRENT_DATE)
    GROUP BY category ORDER BY total DESC`,[req.user.id]);
  const recent=await pool.query('SELECT * FROM transactions WHERE user_id=$1 ORDER BY transaction_date DESC,created_at DESC LIMIT 6',[req.user.id]);
  const s=summary.rows[0], income=Number(s.income), expenses=Number(s.expenses);
  res.json({summary:{income,expenses,balance:money(income-expenses),savingsRate:income?money((income-expenses)/income*100):0,transactionCount:s.transaction_count},
    categories:cats.rows.map(x=>({...x,total:Number(x.total)})),recent:recent.rows});
}));
app.get('/api/budgets',auth,asyncRoute(async(req,res)=>{
  const r=await pool.query(`SELECT b.*, COALESCE(t.spent,0)::numeric(12,2) spent FROM budgets b
    LEFT JOIN (SELECT category,SUM(amount) spent FROM transactions WHERE user_id=$1 AND kind='expense'
    AND date_trunc('month',transaction_date)=date_trunc('month',CURRENT_DATE) GROUP BY category) t ON t.category=b.category
    WHERE b.user_id=$1 ORDER BY b.category`,[req.user.id]);
  res.json({budgets:r.rows.map(b=>({...b,monthly_limit:Number(b.monthly_limit),spent:Number(b.spent),
    utilization:Number(b.monthly_limit)?Number(b.spent)/Number(b.monthly_limit)*100:0,
    alert:Number(b.spent)/Number(b.monthly_limit)>=1?'over-budget':Number(b.spent)/Number(b.monthly_limit)>=.8?'near-limit':'ok'}))});
}));
app.post('/api/budgets',auth,asyncRoute(async(req,res)=>{
  const {category,monthly_limit}=req.body||{}, limit=Number(monthly_limit);
  if(!categories.includes(category)||!Number.isFinite(limit)||limit<=0)return res.status(400).json({error:'Valid category and positive monthly_limit required'});
  const r=await pool.query(`INSERT INTO budgets(id,user_id,category,monthly_limit) VALUES($1,$2,$3,$4)
    ON CONFLICT(user_id,category) DO UPDATE SET monthly_limit=EXCLUDED.monthly_limit RETURNING *`,
    [id(),req.user.id,category,limit]);
  res.status(201).json({budget:r.rows[0]});
}));
app.get('/api/goals',auth,asyncRoute(async(req,res)=>{
  const r=await pool.query('SELECT * FROM goals WHERE user_id=$1 ORDER BY target_date NULLS LAST',[req.user.id]);
  res.json({goals:r.rows.map(g=>({...g,target_amount:Number(g.target_amount),saved_amount:Number(g.saved_amount),progress:Number(g.saved_amount)/Number(g.target_amount)*100}))});
}));
app.post('/api/goals',auth,asyncRoute(async(req,res)=>{
  const {name,target_amount,saved_amount=0,target_date=null}=req.body||{};
  if(!name?.trim()||!Number.isFinite(Number(target_amount))||Number(target_amount)<=0||Number(saved_amount)<0)
    return res.status(400).json({error:'Name and valid target/saved amounts are required'});
  const r=await pool.query('INSERT INTO goals(id,user_id,name,target_amount,saved_amount,target_date) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
    [id(),req.user.id,name.trim(),target_amount,saved_amount,target_date]);
  res.status(201).json({goal:r.rows[0]});
}));
app.get('/api/recurring',auth,asyncRoute(async(req,res)=>{
  const r=await pool.query('SELECT * FROM recurring_payments WHERE user_id=$1 ORDER BY next_due',[req.user.id]);
  res.json({payments:r.rows,upcoming:r.rows.filter(p=>new Date(p.next_due)<=new Date(Date.now()+7*86400000))});
}));
app.post('/api/recurring',auth,asyncRoute(async(req,res)=>{
  const {name,amount,category,next_due,cadence='monthly'}=req.body||{};
  if(!name||!Number.isFinite(Number(amount))||Number(amount)<=0||!categories.includes(category)||!next_due)
    return res.status(400).json({error:'Name, positive amount, category, and next_due are required'});
  const r=await pool.query('INSERT INTO recurring_payments(id,user_id,name,amount,category,next_due,cadence) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [id(),req.user.id,name,amount,category,next_due,cadence]);
  res.status(201).json({payment:r.rows[0]});
}));
app.get('/api/reports/monthly',auth,asyncRoute(async(req,res)=>{
  const r=await pool.query(`SELECT to_char(date_trunc('month',transaction_date),'YYYY-MM') month,
    kind,category,SUM(amount)::numeric(12,2) total FROM transactions WHERE user_id=$1
    GROUP BY 1,2,3 ORDER BY 1 DESC,2,3`,[req.user.id]);
  res.json({report:r.rows});
}));
app.get('/api/insights',auth,asyncRoute(async(req,res)=>{
  const r=await pool.query(`SELECT category,SUM(amount)::float total FROM transactions
    WHERE user_id=$1 AND kind='expense' AND transaction_date>=CURRENT_DATE-INTERVAL '30 days'
    GROUP BY category ORDER BY total DESC`,[req.user.id]);
  const items=r.rows;
  const total=items.reduce((a,x)=>a+x.total,0);
  const insights=[];
  if(items.length){
    insights.push(`You spent ₹${money(total).toLocaleString('en-IN')} across tracked categories in the last 30 days.`);
    insights.push(`Your highest-spend category is ${items[0].category} (₹${money(items[0].total).toLocaleString('en-IN')}).`);
    const food=items.find(x=>x.category==='Food');
    if(food && total && food.total/total>.3) insights.push('Food represents over 30% of recent tracked spending; review this category if you want to reduce costs.');
  } else insights.push('Add a few transactions to receive personalized spending insights.');
  res.json({insights,topCategories:items.slice(0,5),disclaimer:'Insights are descriptive estimates, not financial advice.'});
}));
app.get('/api/forecast',auth,asyncRoute(async(req,res)=>{
  const r=await pool.query(`SELECT COALESCE(SUM(amount),0)::float total, COUNT(DISTINCT transaction_date)::int active_days
    FROM transactions WHERE user_id=$1 AND kind='expense'
    AND date_trunc('month',transaction_date)=date_trunc('month',CURRENT_DATE)`,[req.user.id]);
  const now=new Date(), day=now.getDate(), days=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  const total=r.rows[0].total, activeDays=r.rows[0].active_days;
  res.json({monthToDate:money(total),projectedMonthEnd:money(day?total/day*days:0),activeDays,daysInMonth:days,
    method:'month-to-date spend divided by elapsed calendar days, extrapolated to month end',
    disclaimer:'A simple estimate; it does not account for seasonality or upcoming one-off expenses.'});
}));
app.get('/api/anomalies',auth,asyncRoute(async(req,res)=>{
  const threshold=Math.max(100,Number(req.query.threshold)||5000);
  const r=await pool.query(`SELECT id,amount,category,merchant,note,transaction_date FROM transactions
    WHERE user_id=$1 AND kind='expense' AND amount >= $2 ORDER BY transaction_date DESC LIMIT 50`,[req.user.id,threshold]);
  res.json({flags:r.rows.map(t=>({...t,reason:`Amount is at least ₹${threshold}; review whether this is unusual for you.`,severity:Number(t.amount)>=threshold*2?'high':'review'})),
    method:'transparent fixed-threshold rule; not fraud detection'});
}));
app.get('/api/health-score',auth,asyncRoute(async(req,res)=>{
  const r=await pool.query(`SELECT COALESCE(SUM(amount) FILTER(WHERE kind='income'),0)::float income,
    COALESCE(SUM(amount) FILTER(WHERE kind='expense'),0)::float expenses FROM transactions
    WHERE user_id=$1 AND transaction_date>=date_trunc('month',CURRENT_DATE)`,[req.user.id]);
  const {income,expenses}=r.rows[0];
  const savings=income>0?Math.max(0,Math.min(100,(income-expenses)/income*100)):0;
  res.json({score:Math.round(savings),label:income?'Savings-rate indicator':'Add income to calculate a score',
    factors:{incomeTracked:income>0,monthlyIncome:income,monthlyExpenses:expenses,savingsRatePercent:money(savings)},
    disclaimer:'This is a simple savings-rate indicator, not a credit score or comprehensive financial assessment.'});
}));
app.get('/api/export.csv',auth,asyncRoute(async(req,res)=>{
  const r=await pool.query('SELECT kind,amount,category,merchant,payment_method,note,transaction_date FROM transactions WHERE user_id=$1 ORDER BY transaction_date DESC',[req.user.id]);
  const cell=v=>`"${String(v??'').replaceAll('"','""')}"`;
  const csv=['kind,amount,category,merchant,payment_method,note,transaction_date',...r.rows.map(row=>[row.kind,row.amount,row.category,row.merchant,row.payment_method,row.note,row.transaction_date].map(cell).join(','))].join('\n');
  res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="spendwise-transactions.csv"');res.send(csv);
}));
app.post('/api/receipts/scan',auth,upload.single('receipt'),(req,res)=>{
  if(!req.file)return res.status(400).json({error:'Upload a receipt file using form field "receipt"'});
  res.status(202).json({status:'received',filename:req.file.originalname,sizeBytes:req.file.size,
    extracted:{merchant:null,date:null,amount:null,category:null},
    message:'OCR provider not configured. Connect Tesseract OCR or a trusted OCR API to extract receipt fields.'});
});
app.get('/api/audit',auth,asyncRoute(async(req,res)=>{
  const r=await pool.query('SELECT action,detail,created_at FROM audit_logs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[req.user.id]);
  res.json({events:r.rows});
}));
app.use((err,_req,res,_next)=>{
  console.error(err);
  res.status(500).json({error:'Internal server error'});
});
initDb().then(()=>app.listen(PORT,'0.0.0.0',()=>console.log(`SpendWise API listening on ${PORT}`)))
  .catch(err=>{console.error('Database initialization failed',err);process.exit(1);});
