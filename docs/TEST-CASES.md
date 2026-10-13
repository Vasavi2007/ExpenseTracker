# Test cases

| ID | Scenario | Expected result |
|---|---|---|
| API-01 | API health | HTTP 200 and status `ok` |
| API-02 | Register valid user | HTTP 201 and token |
| API-03 | Register duplicate email | HTTP 409 |
| API-04 | Login with wrong password | HTTP 401 |
| API-05 | Create valid expense | HTTP 201 and transaction |
| API-06 | Negative or zero amount | HTTP 400 |
| API-07 | Access transactions without token | HTTP 401 |
| API-08 | Delete another user's transaction | HTTP 404 |
| API-09 | Budget at 80% | status `NEAR_LIMIT` in analytics service |
| API-10 | Budget over 100% | status `OVER_BUDGET` |
| API-11 | Income 1000, expense 750 | balance 250, savings rate 25% |
| API-12 | Forecast month-end | projected amount is non-negative |
| API-13 | Export CSV | content type text/csv |
| API-14 | Receipt scan without file | HTTP 400 |
| API-15 | Receipt upload with file | HTTP 202, OCR scaffold response |
