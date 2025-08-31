describe('Health Check', () => {
  it('should return 200 OK for health endpoint', () => {
    cy.request('GET', '/health').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('status', 'ok')
      expect(response.body).to.have.property('timestamp')
    })
  })

  it('should return 200 OK for health.php endpoint', () => {
    cy.request('GET', '/health.php').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('status', 'ok')
      expect(response.body).to.have.property('database', 'connected')
      expect(response.body).to.have.property('timestamp')
    })
  })

  it('should return API info at root endpoint', () => {
    cy.request('GET', '/').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('message', 'WebApp API')
      expect(response.body).to.have.property('version', '1.0')
      expect(response.body).to.have.property('endpoints')
    })
  })
})