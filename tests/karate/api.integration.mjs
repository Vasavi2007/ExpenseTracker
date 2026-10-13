
import test from 'node:test';
import assert from 'node:assert/strict';

const API = process.env.API_URL || 'http://localhost:5000';
const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  return { status: response.status, data };
}

async function createUser(label) {
  const user = {
    name: `Test ${label}`,
    email: `${label}-${unique}@example.com`,
    password: 'TestPassword123!'
  };

  const result = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(user)
  });

  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.ok(result.data.token);

  return { ...user, token: result.data.token };
}

function createExpense(amount = 250) {
  return {
    kind: 'expense',
    amount,
    category: 'Food',
    merchant: 'Test Cafe',
    transaction_date: '2026-10-13'
  };
}

// TC01: Check API and database connection
test('TC01 - API health check', async () => {
  const result = await request('/health');

  assert.equal(result.status, 200);
  assert.equal(result.data.status, 'ok');
  assert.equal(result.data.database, 'connected');
});

// TC02: Register a new user
test('TC02 - Successful user registration', async () => {
  const user = await createUser('register');

  assert.ok(user.token);
  assert.match(user.email, /@example\.com$/);
});

// TC03: Reject duplicate email
test('TC03 - Duplicate registration is rejected', async () => {
  const user = await createUser('duplicate');

  const result = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: user.name,
      email: user.email,
      password: user.password
    })
  });

  assert.equal(result.status, 409);
});

// TC04: Reject invalid registration
test('TC04 - Short password is rejected', async () => {
  const result = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Invalid User',
      email: `invalid-${unique}@example.com`,
      password: '123'
    })
  });

  assert.equal(result.status, 400);
});

// TC05: Login with valid credentials
test('TC05 - Successful login', async () => {
  const user = await createUser('login');

  const result = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: user.email,
      password: user.password
    })
  });

  assert.equal(result.status, 200);
  assert.ok(result.data.token);
  assert.equal(result.data.user.email, user.email);
});

// TC06: Reject incorrect password
test('TC06 - Invalid login is rejected', async () => {
  const user = await createUser('badlogin');

  const result = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: user.email,
      password: 'WrongPassword123!'
    })
  });

  assert.equal(result.status, 401);
});

// TC07: Protect transactions endpoint
test('TC07 - Unauthenticated transaction request is rejected', async () => {
  const result = await request('/api/transactions');

  assert.equal(result.status, 401);
});

// TC08: Create a valid expense
test('TC08 - Valid expense is saved', async () => {
  const user = await createUser('expense');

  const result = await request('/api/transactions', {
    method: 'POST',
    token: user.token,
    body: JSON.stringify(createExpense())
  });

  assert.equal(result.status, 201);
  assert.equal(result.data.transaction.category, 'Food');
  assert.equal(Number(result.data.transaction.amount), 250);
});

// TC09: Reject zero and negative amounts
test('TC09 - Invalid expense amounts are rejected', async () => {
  const user = await createUser('invalidamount');

  for (const amount of [0, -50]) {
    const result = await request('/api/transactions', {
      method: 'POST',
      token: user.token,
      body: JSON.stringify(createExpense(amount))
    });

    assert.equal(result.status, 400);
  }
});

// TC10: Users cannot see each other's transactions
test('TC10 - Transaction data is isolated by user', async () => {
  const userA = await createUser('usera');
  const userB = await createUser('userb');

  const created = await request('/api/transactions', {
    method: 'POST',
    token: userA.token,
    body: JSON.stringify(createExpense(450))
  });

  assert.equal(created.status, 201);

  const result = await request('/api/transactions', {
    token: userB.token
  });

  assert.equal(result.status, 200);

  const otherUsersTransactions = result.data.transactions;
  assert.ok(Array.isArray(otherUsersTransactions));

  assert.equal(
    otherUsersTransactions.some(
      item => item.id === created.data.transaction.id
    ),
    false
  );
});

// TC11: Create a budget
test('TC11 - Valid budget is saved', async () => {
  const user = await createUser('budget');

  const result = await request('/api/budgets', {
    method: 'POST',
    token: user.token,
    body: JSON.stringify({
      category: 'Food',
      monthly_limit: 3000
    })
  });

  assert.equal(result.status, 201);
  assert.equal(Number(result.data.budget.monthly_limit), 3000);
});

// TC12: Reject invalid budget
test('TC12 - Zero budget is rejected', async () => {
  const user = await createUser('invalidbudget');

  const result = await request('/api/budgets', {
    method: 'POST',
    token: user.token,
    body: JSON.stringify({
      category: 'Food',
      monthly_limit: 0
    })
  });

  assert.equal(result.status, 400);
});

// TC13: Create a savings goal
test('TC13 - Valid savings goal is saved', async () => {
  const user = await createUser('goal');

  const result = await request('/api/goals', {
    method: 'POST',
    token: user.token,
    body: JSON.stringify({
      name: 'Laptop',
      target_amount: 60000,
      saved_amount: 10000
    })
  });

  assert.equal(result.status, 201);
  assert.equal(result.data.goal.name, 'Laptop');
});

// TC14: Dashboard is available to authenticated users
test('TC14 - Dashboard summary is returned', async () => {
  const user = await createUser('dashboard');

  const result = await request('/api/dashboard', {
    token: user.token
  });

  assert.equal(result.status, 200);
  assert.ok(result.data.summary);
  assert.equal(typeof result.data.summary.balance, 'number');
});
