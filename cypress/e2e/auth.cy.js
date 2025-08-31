describe('Auth flow', () => {
  it('register -> login -> profile', () => {
    const email = `user${Date.now()}@example.com`
    cy.request('POST', '/api/register', { email, password: 'StrongPass123' }).its('status').should('eq', 201)
    cy.request('POST', '/api/login', { email, password: 'StrongPass123' }).its('status').should('eq', 200)
    cy.request('GET', '/api/user').its('status').should('eq', 200)
  })
})