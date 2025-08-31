describe('Admin CRUD', () => {
  it('login and open users list', () => {
    cy.visit('/admin/login.php')
    cy.get('input[name=email]').type('admin@example.com')
    cy.get('input[name=password]').type('StrongPass123')
    cy.contains('button','Sign in').click()
    cy.url().should('include','/admin')
  })
})