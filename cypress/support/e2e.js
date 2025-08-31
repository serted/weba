Cypress.Commands.add('login', (email, password) => {
  return cy.request('POST', '/api/login', { email, password })
})