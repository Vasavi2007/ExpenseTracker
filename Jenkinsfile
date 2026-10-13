pipeline {
  agent any
  environment {
    IMAGE_TAG = "${BUILD_NUMBER}"
  }
  stages {
    stage('Checkout') {
      steps { checkout scm }
    }
    stage('Frontend build') {
      steps { dir('frontend') { sh 'npm install && npm run build' } }
    }
    stage('Node API tests') {
      steps { dir('backend') { sh 'npm install && npm test' } }
    }
    stage('Spring Boot tests') {
      steps { dir('spring-analytics') { sh 'mvn test' } }
    }
    stage('Karate API tests') {
      steps {
        echo 'Start PostgreSQL and API in a test environment before running Karate.'
        sh 'docker compose up -d db analytics api'
        sh 'sleep 10'
        dir('tests/karate') { sh 'mvn test' }
      }
      post { always { sh 'docker compose logs --no-color api || true' } }
    }
    stage('Build images') {
      steps {
        sh 'docker build -t spendwise-api:${IMAGE_TAG} ./backend'
        sh 'docker build -t spendwise-web:${IMAGE_TAG} ./frontend'
        sh 'docker build -t spendwise-analytics:${IMAGE_TAG} ./spring-analytics'
      }
    }
    // Add registry login and Kubernetes deployment credentials in Jenkins Credentials before enabling deployment.
  }
  post { always { sh 'docker compose down || true' } }
}
