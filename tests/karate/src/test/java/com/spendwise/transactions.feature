Feature: SpendWise API smoke and transaction validation
  Background:
    * url baseUrl
    * def uniqueEmail = 'karate-' + java.util.UUID.randomUUID() + '@example.com'

  Scenario: Health endpoint reports healthy service
    Given path '/health'
    When method get
    Then status 200
    And match response.status == 'ok'

  Scenario: Register a user and create a transaction
    Given path '/api/auth/register'
    And request { name: 'Karate User', email: '#(uniqueEmail)', password: 'ChangeMe123!' }
    When method post
    Then status 201
    And match response.token == '#string'
    * def token = response.token
    Given path '/api/transactions'
    And header Authorization = 'Bearer ' + token
    And request { kind: 'expense', amount: 120.50, category: 'Food', merchant: 'Test Cafe', payment_method: 'UPI', note: 'Karate test', transaction_date: '2026-10-12' }
    When method post
    Then status 201
    And match response.transaction.amount == 120.50
    And match response.transaction.category == 'Food'

  Scenario: Reject an invalid transaction amount
    Given path '/api/auth/register'
    And request { name: 'Karate User', email: '#(uniqueEmail)', password: 'ChangeMe123!' }
    When method post
    Then status 201
    * def token = response.token
    Given path '/api/transactions'
    And header Authorization = 'Bearer ' + token
    And request { kind: 'expense', amount: -1, category: 'Food', transaction_date: '2026-10-12' }
    When method post
    Then status 400
    And match response.error contains 'Valid kind'

  Scenario: Unauthenticated transaction request is rejected
    Given path '/api/transactions'
    When method get
    Then status 401
