describe('Admin CRUD', () => {
  it('login and open users list', () => {
    cy.visit('/admin/login.php')
    cy.get('input[name=email]').type('admin@example.com')
    cy.get('input[name=password]').type('StrongPass123')
    cy.contains('button','Sign in').click()
    cy.url().should('include','/admin')
  })
})
describe('Admin Panel', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('should navigate to admin panel', () => {
    cy.get('[data-route="/admin"]').click()
    cy.url().should('include', '/admin')
  })

  it('should handle SPA fallback for admin routes', () => {
    cy.visit('/admin/users')
    cy.contains('WebApp') // Проверяем что SPA загрузилась
  })

  it('should handle SPA fallback for non-existent routes', () => {
    cy.visit('/non-existent-route')
    cy.contains('WebApp') // Проверяем что SPA загрузилась
  })

  it('should load static assets correctly', () => {
    cy.request('/assets/styles.css').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.headers['content-type']).to.include('text/css')
    })
    
    cy.request('/assets/app.js').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.headers['content-type']).to.include('javascript')
    })
  })

  it('should test API endpoints', () => {
    cy.request('/api/health').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('status', 'ok')
    })
  })
})
