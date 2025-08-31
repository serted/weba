
describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('should load homepage', () => {
    cy.contains('Добро пожаловать в WebApp')
    cy.get('[data-route="/"]').should('be.visible')
  })

  it('should navigate to login page', () => {
    cy.get('[data-route="/login"]').click()
    cy.url().should('include', '/login')
    cy.contains('Вход в систему')
    cy.get('#login-form').should('be.visible')
  })

  it('should navigate to register page', () => {
    cy.get('[data-route="/register"]').click()
    cy.url().should('include', '/register')
    cy.contains('Регистрация')
    cy.get('#register-form').should('be.visible')
  })

  it('should show validation error on empty login', () => {
    cy.get('[data-route="/login"]').click()
    cy.get('#login-form').submit()
    cy.get('#login-result').should('contain', 'Ошибка')
  })

  it('should test API health check', () => {
    cy.visit('/')
    cy.get('button').contains('Проверить API').click()
    cy.get('#api-result').should('contain', 'API работает')
  })

  it('should register and login user', () => {
    // Регистрация
    cy.get('[data-route="/register"]').click()
    cy.get('#email').type('test@example.com')
    cy.get('#password').type('password123')
    cy.get('#register-form').submit()
    cy.get('#register-result').should('contain', 'Регистрация успешна')
    
    // Переход на логин
    cy.wait(1500)
    cy.url().should('include', '/login')
    
    // Логин
    cy.get('#email').type('test@example.com')
    cy.get('#password').type('password123')
    cy.get('#login-form').submit()
    cy.get('#login-result').should('contain', 'Вход выполнен успешно')
    
    // Проверка перехода в профиль
    cy.wait(1500)
    cy.url().should('include', '/profile')
    cy.contains('Профиль пользователя')
  })

  it('should protect profile page', () => {
    cy.visit('/profile')
    cy.url().should('include', '/login')
  })

  it('should logout user', () => {
    // Сначала логинимся
    cy.get('[data-route="/login"]').click()
    cy.get('#email').type('test@example.com')
    cy.get('#password').type('password123')
    cy.get('#login-form').submit()
    cy.wait(1500)
    
    // Выходим
    cy.get('button').contains('Выйти').click()
    cy.url().should('include', '/')
    cy.get('[data-route="/login"]').should('be.visible')
  })
})
