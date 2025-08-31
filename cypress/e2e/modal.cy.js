describe('Modal Windows Testing', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should test all modal interactions on dashboard', () => {
    // Navigate to dashboard (assuming it has modals)
    cy.visit('/dashboard');
    
    // Find and test modal triggers
    cy.get('body').then($body => {
      const modalTriggers = [
        'button:contains("Add")',
        'button:contains("Edit")',
        'button:contains("Delete")',
        'button:contains("Create")',
        'button:contains("New")',
        '.btn-modal',
        '[data-toggle="modal"]',
        '[data-bs-toggle="modal"]',
        '.open-modal'
      ];

      modalTriggers.forEach(selector => {
        if ($body.find(selector).length > 0) {
          // Test opening modal
          cy.get(selector).first().click();
          
          // Check if modal is visible
          cy.get('.modal, .popup, .dialog').should('be.visible');
          
          // Test closing with Escape key
          cy.get('body').type('{esc}');
          cy.wait(500);
          
          // If modal is still visible, try close button
          cy.get('body').then($bodyAfterEsc => {
            if ($bodyAfterEsc.find('.modal:visible, .popup:visible, .dialog:visible').length > 0) {
              cy.get('.close, .modal-close, [aria-label="close"], .btn-close').first().click();
              cy.wait(500);
            }
          });
          
          // If modal is still visible, click outside
          cy.get('body').then($bodyAfterClose => {
            if ($bodyAfterClose.find('.modal:visible, .popup:visible, .dialog:visible').length > 0) {
              cy.get('body').click(10, 10);
              cy.wait(500);
            }
          });
          
          // Verify modal is closed
          cy.get('.modal, .popup, .dialog').should('not.be.visible');
        }
      });
    });
  });

  it('should test modals on admin pages', () => {
    // Test admin user management modals
    cy.visit('/admin/users');
    
    cy.get('body').then($body => {
      if ($body.find('button:contains("Add User"), .add-user-btn').length > 0) {
        // Open add user modal
        cy.get('button:contains("Add User"), .add-user-btn').first().click();
        cy.get('.modal').should('be.visible');
        
        // Take screenshot for visual comparison
        cy.screenshot('admin-users-modal-open');
        
        // Test form fields if they exist
        cy.get('.modal').within(() => {
          cy.get('input[name="username"], #username').should('exist');
          cy.get('input[name="email"], #email').should('exist');
          cy.get('input[name="password"], #password').should('exist');
        });
        
        // Close modal
        cy.get('.modal .close, .modal .btn-close').first().click();
        cy.get('.modal').should('not.be.visible');
      }
    });
  });

  it('should handle modal validation and error states', () => {
    cy.visit('/admin/users');
    
    cy.get('body').then($body => {
      if ($body.find('button:contains("Add User"), .add-user-btn').length > 0) {
        cy.get('button:contains("Add User"), .add-user-btn').first().click();
        
        // Submit empty form to trigger validation
        cy.get('.modal form').within(() => {
          cy.get('button[type="submit"], .btn-submit').click();
        });
        
        // Check for validation errors
        cy.get('.modal .error, .modal .invalid-feedback, .modal .alert-danger').should('be.visible');
        
        // Close modal
        cy.get('body').type('{esc}');
      }
    });
  });

  it('should test confirmation modals', () => {
    cy.visit('/admin/users');
    
    cy.get('body').then($body => {
      if ($body.find('button:contains("Delete"), .btn-delete').length > 0) {
        // Click delete button to trigger confirmation modal
        cy.get('button:contains("Delete"), .btn-delete').first().click();
        
        // Check for confirmation modal
        cy.get('.modal, .confirm-dialog, .alert').should('be.visible');
        cy.get('.modal, .confirm-dialog, .alert').should('contain.text', 'confirm');
        
        // Test cancel
        cy.get('button:contains("Cancel"), .btn-cancel').click();
        cy.get('.modal, .confirm-dialog, .alert').should('not.be.visible');
      }
    });
  });

  it('should test modal backdrop behavior', () => {
    cy.visit('/dashboard');
    
    cy.get('body').then($body => {
      if ($body.find('[data-toggle="modal"], .btn-modal').length > 0) {
        cy.get('[data-toggle="modal"], .btn-modal').first().click();
        
        // Click on backdrop (outside modal content)
        cy.get('.modal-backdrop, .modal-overlay').click({ force: true });
        
        // Modal should close
        cy.get('.modal').should('not.be.visible');
      }
    });
  });

  it('should test nested modals if they exist', () => {
    cy.visit('/admin/settings');
    
    cy.get('body').then($body => {
      if ($body.find('.settings-modal-trigger').length > 0) {
        // Open first modal
        cy.get('.settings-modal-trigger').first().click();
        cy.get('.modal').should('be.visible');
        
        // Try to open second modal from within first
        cy.get('.modal').within(() => {
          cy.get('button:contains("Advanced"), .advanced-btn').then($advancedBtn => {
            if ($advancedBtn.length > 0) {
              cy.wrap($advancedBtn).click();
              
              // Check if nested modal opens
              cy.get('body').then($bodyWithNested => {
                if ($bodyWithNested.find('.modal').length > 1) {
                  cy.screenshot('nested-modals');
                  
                  // Close nested modal first
                  cy.get('.modal').last().within(() => {
                    cy.get('.close, .btn-close').click();
                  });
                }
              });
            }
          });
        });
        
        // Close main modal
        cy.get('body').type('{esc}');
      }
    });
  });
});