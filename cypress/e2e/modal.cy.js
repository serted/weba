describe('Comprehensive Modal Windows Testing', () => {
  // Define all 14 pages and their expected user states
  const PAGES_TO_TEST = [
    { name: 'home', url: '/', states: ['guest', 'user', 'admin'] },
    { name: 'login', url: '/login', states: ['guest'] },
    { name: 'register', url: '/register', states: ['guest'] },
    { name: 'dashboard', url: '/dashboard', states: ['user', 'admin'] },
    { name: 'profile', url: '/profile', states: ['user', 'admin'] },
    { name: 'settings', url: '/settings', states: ['user', 'admin'] },
    { name: 'admin-users', url: '/admin/users', states: ['admin'] },
    { name: 'admin-roles', url: '/admin/roles', states: ['admin'] },
    { name: 'admin-logs', url: '/admin/logs', states: ['admin'] },
    { name: 'api-docs', url: '/api/docs', states: ['guest', 'user', 'admin'] },
    { name: 'help', url: '/help', states: ['guest', 'user', 'admin'] },
    { name: 'contact', url: '/contact', states: ['guest', 'user', 'admin'] },
    { name: 'about', url: '/about', states: ['guest', 'user', 'admin'] },
    { name: 'terms', url: '/terms', states: ['guest', 'user', 'admin'] }
  ];

  const MODAL_SELECTORS = [
    'button:contains("Add")',
    'button:contains("Edit")',
    'button:contains("Delete")',
    'button:contains("Create")',
    'button:contains("New")',
    'button:contains("Update")',
    'button:contains("Save")',
    '.btn-modal',
    '.btn-primary',
    '.btn-secondary',
    '[data-toggle="modal"]',
    '[data-bs-toggle="modal"]',
    '.open-modal',
    '.modal-trigger'
  ];

  const MODAL_CONTAINERS = [
    '.modal',
    '.popup',
    '.dialog',
    '.overlay',
    '.modal-dialog',
    '.lightbox'
  ];

  const CLOSE_SELECTORS = [
    '.close',
    '.modal-close',
    '[aria-label="close"]',
    '.btn-close',
    '.modal-header .btn',
    '[data-dismiss="modal"]',
    '.dismiss'
  ];

  beforeEach(() => {
    cy.visit('/');
  });

  // Helper function to login as different user types
  function loginAs(userType) {
    if (userType === 'guest') return;
    
    cy.visit('/login');
    cy.get('input[name="email"], input[name="username"], #email, #username')
      .type('test228');
    cy.get('input[name="password"], #password')
      .type('test228');
    cy.get('form button[type="submit"], form input[type="submit"]').click();
    cy.wait(2000); // Wait for login to complete
  }

  // Helper function to test modal interactions
  function testModalInteractions(pageName, userState) {
    cy.get('body').then($body => {
      let modalCount = 0;
      
      MODAL_SELECTORS.forEach((selector, index) => {
        if ($body.find(selector).length > 0) {
          cy.get(selector).each(($trigger, triggerIndex) => {
            cy.wrap($trigger).then($el => {
              if ($el.is(':visible')) {
                modalCount++;
                const modalId = `${pageName}-${userState}-modal-${modalCount}`;
                
                cy.log(`Testing modal trigger ${modalCount} on ${pageName} as ${userState}`);
                
                // Click trigger to open modal
                cy.wrap($el).click({ force: true });
                cy.wait(1000);
                
                // Check if any modal container is now visible
                let modalVisible = false;
                MODAL_CONTAINERS.forEach(container => {
                  cy.get('body').then($bodyAfterClick => {
                    if ($bodyAfterClick.find(`${container}:visible`).length > 0) {
                      modalVisible = true;
                      
                      cy.log(`✓ Modal opened: ${modalId}`);
                      
                      // Take screenshot of modal open state
                      cy.screenshot(`${modalId}-open`);
                      
                      // Test Esc key closing
                      cy.get('body').type('{esc}');
                      cy.wait(1000);
                      
                      // Check if modal closed with Esc
                      cy.get('body').then($bodyAfterEsc => {
                        if ($bodyAfterEsc.find(`${container}:visible`).length > 0) {
                          cy.log('Modal still open, trying close button...');
                          
                          // Try close button
                          CLOSE_SELECTORS.forEach(closeSelector => {
                            cy.get('body').then($bodyBeforeClose => {
                              if ($bodyBeforeClose.find(`${container}:visible ${closeSelector}`).length > 0) {
                                cy.get(`${container}:visible ${closeSelector}`).first().click({ force: true });
                                cy.wait(500);
                              }
                            });
                          });
                          
                          // If still open, try backdrop click
                          cy.get('body').then($bodyAfterCloseBtn => {
                            if ($bodyAfterCloseBtn.find(`${container}:visible`).length > 0) {
                              cy.log('Modal still open, trying backdrop click...');
                              cy.get('body').click(50, 50, { force: true });
                              cy.wait(500);
                            }
                          });
                        }
                      });
                      
                      // Take screenshot of modal closed state
                      cy.screenshot(`${modalId}-closed`);
                      cy.log(`✓ Modal interaction completed: ${modalId}`);
                    }
                  });
                });
                
                if (!modalVisible) {
                  cy.log(`- Trigger ${modalCount} did not open a modal`);
                }
              }
            });
          });
        }
      });
      
      if (modalCount === 0) {
        cy.log(`No modal triggers found on ${pageName} as ${userState}`);
      } else {
        cy.log(`Tested ${modalCount} modal triggers on ${pageName} as ${userState}`);
      }
    });
  }

  // Test modals as guest user
  describe('Guest User Modal Testing', () => {
    PAGES_TO_TEST
      .filter(page => page.states.includes('guest'))
      .forEach(page => {
        it(`should test modals on ${page.name} as guest`, () => {
          cy.visit(page.url);
          cy.wait(2000);
          testModalInteractions(page.name, 'guest');
        });
      });
  });

  // Test modals as authenticated user
  describe('Authenticated User Modal Testing', () => {
    beforeEach(() => {
      loginAs('user');
    });

    PAGES_TO_TEST
      .filter(page => page.states.includes('user'))
      .forEach(page => {
        it(`should test modals on ${page.name} as user`, () => {
          cy.visit(page.url);
          cy.wait(2000);
          testModalInteractions(page.name, 'user');
        });
      });
  });

  // Test modals as admin user
  describe('Admin User Modal Testing', () => {
    beforeEach(() => {
      loginAs('admin');
    });

    PAGES_TO_TEST
      .filter(page => page.states.includes('admin'))
      .forEach(page => {
        it(`should test modals on ${page.name} as admin`, () => {
          cy.visit(page.url);
          cy.wait(2000);
          testModalInteractions(page.name, 'admin');
        });
      });
  });

  // Specific tests for common modal scenarios
  describe('Modal Form Validation Testing', () => {
    beforeEach(() => {
      loginAs('admin');
    });

    it('should test form validation in modals', () => {
      const formsPages = ['admin-users', 'admin-roles', 'profile', 'settings'];
      
      formsPages.forEach(pageName => {
        const pageData = PAGES_TO_TEST.find(p => p.name === pageName);
        if (pageData) {
          cy.visit(pageData.url);
          cy.wait(2000);
          
          // Look for Add/Create buttons that likely open form modals
          cy.get('body').then($body => {
            const formTriggers = [
              'button:contains("Add")',
              'button:contains("Create")',
              'button:contains("New")',
              '.btn-primary'
            ];
            
            formTriggers.forEach(selector => {
              if ($body.find(selector).length > 0) {
                cy.get(selector).first().click({ force: true });
                cy.wait(1000);
                
                // Check if modal with form opened
                MODAL_CONTAINERS.forEach(container => {
                  cy.get('body').then($modalBody => {
                    if ($modalBody.find(`${container}:visible form`).length > 0) {
                      cy.log(`Testing form validation in modal on ${pageName}`);
                      
                      // Try submitting empty form
                      cy.get(`${container}:visible form`).within(() => {
                        cy.get('button[type="submit"], .btn-submit, .btn-save').first().click();
                      });
                      
                      // Check for validation errors
                      cy.get(`${container}:visible`).within(() => {
                        cy.get('.error, .invalid-feedback, .alert-danger, .text-danger')
                          .should('exist');
                      });
                      
                      // Take screenshot of validation state
                      cy.screenshot(`${pageName}-modal-validation`);
                      
                      // Close modal
                      cy.get('body').type('{esc}');
                      cy.wait(500);
                    }
                  });
                });
              }
            });
          });
        }
      });
    });
  });

  describe('Modal Accessibility Testing', () => {
    beforeEach(() => {
      loginAs('admin');
    });

    it('should test modal accessibility features', () => {
      cy.visit('/admin/users');
      cy.wait(2000);
      
      cy.get('body').then($body => {
        if ($body.find('button:contains("Add"), .btn-modal').length > 0) {
          cy.get('button:contains("Add"), .btn-modal').first().click();
          cy.wait(1000);
          
          MODAL_CONTAINERS.forEach(container => {
            cy.get('body').then($modalBody => {
              if ($modalBody.find(`${container}:visible`).length > 0) {
                // Check for proper ARIA attributes
                cy.get(`${container}:visible`).should('have.attr', 'role');
                cy.get(`${container}:visible`).should('have.attr', 'aria-hidden', 'false');
                
                // Check for focus trap
                cy.get(`${container}:visible`).within(() => {
                  cy.get('button, input, select, textarea, [tabindex]').first().should('be.focused');
                });
                
                // Test tab navigation
                cy.get('body').type('{tab}');
                cy.get(`${container}:visible`).within(() => {
                  cy.focused().should('exist');
                });
                
                cy.screenshot('modal-accessibility-test');
                cy.get('body').type('{esc}');
              }
            });
          });
        }
      });
    });
  });

  describe('Modal Performance Testing', () => {
    it('should test modal loading times', () => {
      const startTime = Date.now();
      
      cy.visit('/admin/users');
      cy.wait(2000);
      
      cy.get('body').then($body => {
        if ($body.find('button:contains("Add")').length > 0) {
          const modalOpenStart = Date.now();
          
          cy.get('button:contains("Add")').first().click();
          
          cy.get('.modal:visible').should('exist').then(() => {
            const modalOpenEnd = Date.now();
            const modalLoadTime = modalOpenEnd - modalOpenStart;
            
            cy.log(`Modal load time: ${modalLoadTime}ms`);
            expect(modalLoadTime).to.be.lessThan(2000); // Should load within 2 seconds
            
            cy.screenshot('modal-performance-test');
            cy.get('body').type('{esc}');
          });
        }
      });
    });
  });
});