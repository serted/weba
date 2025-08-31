describe('Authentication UI/UX Testing', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  describe('Registration Form', () => {
    beforeEach(() => {
      cy.visit('/register');
    });

    it('should display registration form with all required fields', () => {
      cy.get('form').should('exist');
      cy.get('input[name="username"], #username').should('exist');
      cy.get('input[name="email"], #email').should('exist');
      cy.get('input[name="password"], #password').should('exist');
      cy.get('input[name="password_confirmation"], #password_confirmation').should('exist');
      cy.get('button[type="submit"], input[type="submit"]').should('exist');
    });

    it('should validate empty form submission', () => {
      cy.get('form button[type="submit"], form input[type="submit"]').click();
      
      // Check for validation messages
      cy.get('.error, .invalid-feedback, .alert-danger, .text-danger').should('be.visible');
    });

    it('should validate individual field requirements', () => {
      // Test username validation
      cy.get('input[name="username"], #username').type('ab'); // Too short
      cy.get('input[name="email"], #email').focus(); // Trigger validation
      cy.get('.error, .invalid-feedback').should('contain.text', 'username');

      // Test email validation
      cy.get('input[name="email"], #email').type('invalid-email');
      cy.get('input[name="password"], #password').focus();
      cy.get('.error, .invalid-feedback').should('contain.text', 'email');

      // Test password validation
      cy.get('input[name="password"], #password').type('123'); // Too short
      cy.get('input[name="password_confirmation"], #password_confirmation').focus();
      cy.get('.error, .invalid-feedback').should('contain.text', 'password');

      // Test password confirmation
      cy.get('input[name="password"], #password').clear().type('validPassword123');
      cy.get('input[name="password_confirmation"], #password_confirmation').type('differentPassword');
      cy.get('button[type="submit"]').focus();
      cy.get('.error, .invalid-feedback').should('contain.text', 'match');
    });

    it('should make API call to correct registration endpoint', () => {
      // Intercept the registration API call
      cy.intercept('POST', '**/api/register', { statusCode: 200, body: { success: true } }).as('registerAPI');
      
      // Fill in valid registration data
      cy.get('input[name="username"], #username').type('testuser123');
      cy.get('input[name="email"], #email').type('test@example.com');
      cy.get('input[name="password"], #password').type('validPassword123');
      cy.get('input[name="password_confirmation"], #password_confirmation').type('validPassword123');
      
      // Submit form
      cy.get('form button[type="submit"], form input[type="submit"]').click();
      
      // Verify API call was made to correct endpoint
      cy.wait('@registerAPI').then((interception) => {
        expect(interception.request.url).to.include('/api/register');
        expect(interception.request.method).to.equal('POST');
        expect(interception.request.body).to.have.property('username', 'testuser123');
        expect(interception.request.body).to.have.property('email', 'test@example.com');
      });
    });

    it('should handle CSRF token in registration request', () => {
      cy.intercept('POST', '**/api/register').as('registerAPI');
      
      // Check if CSRF token exists in form
      cy.get('input[name="_token"], input[name="csrf_token"], meta[name="csrf-token"]').should('exist');
      
      // Fill and submit form
      cy.get('input[name="username"], #username').type('testuser123');
      cy.get('input[name="email"], #email').type('test@example.com');
      cy.get('input[name="password"], #password').type('validPassword123');
      cy.get('input[name="password_confirmation"], #password_confirmation').type('validPassword123');
      cy.get('form').submit();
      
      // Check if CSRF token is included in request
      cy.wait('@registerAPI').then((interception) => {
        const hasCSRFHeader = interception.request.headers['x-csrf-token'] || 
                             interception.request.headers['x-xsrf-token'];
        const hasCSRFInBody = interception.request.body._token || 
                            interception.request.body.csrf_token;
        
        expect(hasCSRFHeader || hasCSRFInBody).to.exist;
      });
    });

    it('should handle registration errors gracefully', () => {
      // Mock error response
      cy.intercept('POST', '**/api/register', { 
        statusCode: 422, 
        body: { 
          errors: {
            email: ['The email has already been taken.'],
            username: ['The username is required.']
          }
        }
      }).as('registerError');
      
      cy.get('input[name="username"], #username').type('existinguser');
      cy.get('input[name="email"], #email').type('existing@example.com');
      cy.get('input[name="password"], #password').type('password123');
      cy.get('input[name="password_confirmation"], #password_confirmation').type('password123');
      cy.get('form').submit();
      
      cy.wait('@registerError');
      
      // Check if errors are displayed
      cy.get('.error, .invalid-feedback, .alert-danger').should('be.visible');
      cy.get('.error, .invalid-feedback, .alert-danger').should('contain.text', 'email');
    });
  });

  describe('Login Form', () => {
    beforeEach(() => {
      cy.visit('/login');
    });

    it('should display login form with required fields', () => {
      cy.get('form').should('exist');
      cy.get('input[name="email"], input[name="username"], #email, #username').should('exist');
      cy.get('input[name="password"], #password').should('exist');
      cy.get('button[type="submit"], input[type="submit"]').should('exist');
    });

    it('should validate empty login form', () => {
      cy.get('form button[type="submit"], form input[type="submit"]').click();
      cy.get('.error, .invalid-feedback, .alert-danger').should('be.visible');
    });

    it('should make API call to correct login endpoint', () => {
      cy.intercept('POST', '**/api/login', { 
        statusCode: 200, 
        body: { 
          success: true, 
          token: 'fake-jwt-token',
          user: { id: 1, email: 'test@example.com' }
        }
      }).as('loginAPI');
      
      cy.get('input[name="email"], input[name="username"], #email, #username').type('test@example.com');
      cy.get('input[name="password"], #password').type('password123');
      cy.get('form').submit();
      
      cy.wait('@loginAPI').then((interception) => {
        expect(interception.request.url).to.include('/api/login');
        expect(interception.request.method).to.equal('POST');
      });
    });

    it('should handle JWT cookie after successful login', () => {
      cy.intercept('POST', '**/api/login', { 
        statusCode: 200, 
        body: { success: true, token: 'fake-jwt-token' },
        headers: {
          'Set-Cookie': 'jwt_token=fake-jwt-token; HttpOnly; Secure; SameSite=Strict'
        }
      }).as('loginSuccess');
      
      cy.get('input[name="email"], input[name="username"], #email, #username').type('test@example.com');
      cy.get('input[name="password"], #password').type('password123');
      cy.get('form').submit();
      
      cy.wait('@loginSuccess');
      
      // Check if JWT cookie is set (Note: HttpOnly cookies can't be accessed via JS)
      // We check for redirect or UI changes instead
      cy.url().should('not.contain', '/login');
      cy.get('body').should('not.contain', 'Login');
    });

    it('should handle login failures appropriately', () => {
      cy.intercept('POST', '**/api/login', { 
        statusCode: 401, 
        body: { error: 'Invalid credentials' }
      }).as('loginFail');
      
      cy.get('input[name="email"], input[name="username"], #email, #username').type('wrong@example.com');
      cy.get('input[name="password"], #password').type('wrongpassword');
      cy.get('form').submit();
      
      cy.wait('@loginFail');
      
      // Should stay on login page and show error
      cy.url().should('contain', '/login');
      cy.get('.error, .invalid-feedback, .alert-danger').should('be.visible');
      cy.get('.error, .invalid-feedback, .alert-danger').should('contain.text', 'Invalid');
    });

    it('should handle rate limiting (429 responses)', () => {
      cy.intercept('POST', '**/api/login', { 
        statusCode: 429, 
        body: { error: 'Too many login attempts. Please try again later.' }
      }).as('rateLimited');
      
      // Try multiple rapid logins
      for (let i = 0; i < 3; i++) {
        cy.get('input[name="email"], input[name="username"], #email, #username').clear().type('test@example.com');
        cy.get('input[name="password"], #password').clear().type('password123');
        cy.get('form').submit();
        cy.wait(500);
      }
      
      cy.wait('@rateLimited');
      cy.get('.error, .alert-danger').should('contain.text', 'Too many');
    });

    it('should include CSRF protection in login requests', () => {
      cy.intercept('POST', '**/api/login').as('loginRequest');
      
      cy.get('input[name="email"], input[name="username"], #email, #username').type('test@example.com');
      cy.get('input[name="password"], #password').type('password123');
      cy.get('form').submit();
      
      cy.wait('@loginRequest').then((interception) => {
        // Check for CSRF token in headers or body
        const hasCSRFHeader = interception.request.headers['x-csrf-token'] || 
                             interception.request.headers['x-xsrf-token'];
        const hasCSRFInBody = interception.request.body._token || 
                            interception.request.body.csrf_token;
        
        expect(hasCSRFHeader || hasCSRFInBody).to.exist;
      });
    });
  });

  describe('Authentication State Management', () => {
    it('should redirect to login when accessing protected pages', () => {
      cy.visit('/dashboard');
      cy.url().should('contain', '/login');
    });

    it('should redirect to dashboard after successful login', () => {
      cy.intercept('POST', '**/api/login', { 
        statusCode: 200, 
        body: { success: true, redirect: '/dashboard' }
      }).as('loginSuccess');
      
      cy.visit('/login');
      cy.get('input[name="email"], input[name="username"], #email, #username').type('test@example.com');
      cy.get('input[name="password"], #password').type('password123');
      cy.get('form').submit();
      
      cy.wait('@loginSuccess');
      cy.url().should('contain', '/dashboard');
    });

    it('should handle logout functionality', () => {
      // First login
      cy.intercept('POST', '**/api/login', { statusCode: 200, body: { success: true } }).as('login');
      cy.intercept('POST', '**/api/logout', { statusCode: 200, body: { success: true } }).as('logout');
      
      cy.visit('/login');
      cy.get('input[name="email"], input[name="username"], #email, #username').type('test@example.com');
      cy.get('input[name="password"], #password').type('password123');
      cy.get('form').submit();
      cy.wait('@login');
      
      // Then logout
      cy.get('a[href*="logout"], .logout-btn, button:contains("Logout")').click();
      cy.wait('@logout');
      
      // Should redirect to login
      cy.url().should('contain', '/login');
    });

    it('should maintain session across page refreshes', () => {
      // Simulate being logged in
      cy.intercept('GET', '**/api/user', { 
        statusCode: 200, 
        body: { id: 1, email: 'test@example.com', authenticated: true }
      }).as('checkAuth');
      
      cy.visit('/dashboard');
      cy.reload();
      
      cy.wait('@checkAuth');
      cy.url().should('not.contain', '/login');
    });
  });

  describe('Password Reset Flow', () => {
    it('should handle forgot password requests', () => {
      cy.visit('/login');
      
      cy.get('a:contains("Forgot"), .forgot-password').then($forgotLink => {
        if ($forgotLink.length > 0) {
          cy.wrap($forgotLink).click();
          
          cy.intercept('POST', '**/api/password/email', { 
            statusCode: 200, 
            body: { message: 'Password reset link sent' }
          }).as('forgotPassword');
          
          cy.get('input[name="email"], #email').type('test@example.com');
          cy.get('form').submit();
          
          cy.wait('@forgotPassword');
          cy.get('.success, .alert-success').should('contain.text', 'reset');
        }
      });
    });
  });
});