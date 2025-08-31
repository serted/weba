#!/bin/bash

# Deployment Packaging Script
# Creates a clean, production-ready deployment package

set -e

echo "🎁 Starting deployment packaging process..."

# Configuration
PACKAGE_DIR="deploy_package"
CURRENT_DIR="$(pwd)"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="deploy_backup_${TIMESTAMP}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to backup existing package
backup_existing_package() {
    if [ -d "$PACKAGE_DIR" ]; then
        log_info "Backing up existing package to $BACKUP_DIR"
        mv "$PACKAGE_DIR" "$BACKUP_DIR"
    fi
}

# Function to clean old backups (keep last 3)
cleanup_old_backups() {
    log_info "Cleaning up old backup directories..."
    ls -dt deploy_backup_* 2>/dev/null | tail -n +4 | xargs rm -rf
}

# Function to install production dependencies
install_production_deps() {
    log_info "Installing production PHP dependencies..."
    
    # Backup current vendor if exists
    if [ -d "vendor" ]; then
        mv vendor vendor_backup_temp
    fi
    
    # Install production dependencies
    composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist --quiet
    
    if [ $? -ne 0 ]; then
        log_error "Failed to install PHP dependencies"
        # Restore backup if installation failed
        if [ -d "vendor_backup_temp" ]; then
            mv vendor_backup_temp vendor
        fi
        exit 1
    fi
    
    log_success "PHP dependencies installed"
    
    # Install Node.js dependencies (for asset building)
    if [ -f "package.json" ]; then
        log_info "Installing Node.js dependencies..."
        npm ci --only=production --silent
        
        if [ $? -ne 0 ]; then
            log_warning "Node.js dependencies installation failed, continuing anyway"
        else
            log_success "Node.js dependencies installed"
        fi
    fi
}

# Function to build assets
build_assets() {
    if [ -f "package.json" ] && [ -n "$(npm run 2>&1 | grep build)" ]; then
        log_info "Building frontend assets..."
        npm run build 2>/dev/null || {
            log_warning "Asset build failed or no build script found, continuing anyway"
        }
    fi
}

# Function to create package directory structure
create_package_structure() {
    log_info "Creating package directory structure..."
    
    mkdir -p "$PACKAGE_DIR"
    
    # Create necessary subdirectories
    mkdir -p "$PACKAGE_DIR/public"
    mkdir -p "$PACKAGE_DIR/src"
    mkdir -p "$PACKAGE_DIR/config"
    mkdir -p "$PACKAGE_DIR/migrations"
    mkdir -p "$PACKAGE_DIR/scripts"
    mkdir -p "$PACKAGE_DIR/admin"
    
    log_success "Package structure created"
}

# Function to copy essential files using rsync
copy_essential_files() {
    log_info "Copying essential application files..."
    
    # Copy main directories
    rsync -a --quiet public/ "$PACKAGE_DIR/public/"
    rsync -a --quiet src/ "$PACKAGE_DIR/src/"
    rsync -a --quiet config/ "$PACKAGE_DIR/config/"
    rsync -a --quiet migrations/ "$PACKAGE_DIR/migrations/"
    rsync -a --quiet admin/ "$PACKAGE_DIR/admin/"
    
    # Copy vendor directory (production dependencies)
    rsync -a --quiet vendor/ "$PACKAGE_DIR/vendor/"
    
    # Copy essential root files
    cp composer.json "$PACKAGE_DIR/"
    cp composer.lock "$PACKAGE_DIR/"
    
    # Copy environment template
    cp .env.example "$PACKAGE_DIR/"
    
    # Copy deployment script if it exists
    if [ -f "scripts/deploy.sh" ]; then
        cp scripts/deploy.sh "$PACKAGE_DIR/scripts/"
        chmod +x "$PACKAGE_DIR/scripts/deploy.sh"
    fi
    
    # Copy migration script
    if [ -f "scripts/migrate.php" ]; then
        cp scripts/migrate.php "$PACKAGE_DIR/scripts/"
    fi
    
    # Copy any built assets
    if [ -d "public/dist" ]; then
        rsync -a --quiet public/dist/ "$PACKAGE_DIR/public/dist/"
    fi
    
    if [ -d "public/build" ]; then
        rsync -a --quiet public/build/ "$PACKAGE_DIR/public/build/"
    fi
    
    log_success "Essential files copied"
}

# Function to create deployment instructions
create_deployment_instructions() {
    log_info "Creating deployment instructions..."
    
    cat > "$PACKAGE_DIR/DEPLOYMENT_INSTRUCTIONS.md" << 'EOF'
# Deployment Instructions

## Prerequisites
- PHP 8.1 or higher
- MySQL 5.7 or higher
- Web server (Apache/Nginx)
- Composer (if not using pre-built package)

## Deployment Steps

1. **Upload Files**
   ```bash
   # Extract the package
   unzip deploy_package.zip
   
   # Upload all files to your web root
   rsync -avz deploy_package/ user@server:/var/www/html/
   ```

2. **Environment Configuration**
   ```bash
   # Copy and edit environment file
   cp .env.example .env
   nano .env
   
   # Set your database credentials and other configuration
   DB_HOST=localhost
   DB_NAME=your_database_name
   DB_USER=your_database_user
   DB_PASS=your_database_password
   ```

3. **Database Setup**
   ```bash
   # Run migrations
   php scripts/migrate.php
   ```

4. **File Permissions**
   ```bash
   # Set proper permissions
   chmod -R 755 public/
   chmod -R 700 config/
   chown -R www-data:www-data /var/www/html/
   ```

5. **Web Server Configuration**
   
   **Apache (.htaccess should work automatically)**
   
   **Nginx**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       root /var/www/html/public;
       index index.php index.html;
       
       location / {
           try_files $uri $uri/ /index.php?$query_string;
       }
       
       location ~ \.php$ {
           fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
           fastcgi_index index.php;
           fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
           include fastcgi_params;
       }
   }
   ```

6. **SSL Configuration (Recommended)**
   ```bash
   # Use Let's Encrypt
   certbot --nginx -d your-domain.com
   ```

## Health Check
After deployment, verify the installation:
- Visit: https://your-domain.com/health
- Should return: `{"status":"ok","database":"connected"}`

## Troubleshooting
- Check PHP error logs: `/var/log/php/error.log`
- Check web server logs: `/var/log/nginx/error.log` or `/var/log/apache2/error.log`
- Verify file permissions and ownership
- Ensure database connection works

EOF

    log_success "Deployment instructions created"
}

# Function to create automated deployment script
create_deployment_script() {
    log_info "Creating automated deployment script..."
    
    cat > "$PACKAGE_DIR/scripts/deploy.sh" << 'EOF'
#!/bin/bash

# Automated Deployment Script
set -e

echo "🚀 Starting automated deployment..."

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Creating .env from template..."
    cp .env.example .env
    echo "✏️  Please edit .env file with your configuration before proceeding"
    echo "Press Enter when ready to continue..."
    read
fi

# Run database migrations
echo "🗃️  Running database migrations..."
php scripts/migrate.php

# Set permissions
echo "🔒 Setting file permissions..."
chmod -R 755 public/
chmod 600 .env

# Test the application
echo "🧪 Testing application..."
if curl -f -s http://localhost/health > /dev/null; then
    echo "✅ Application is responding correctly"
else
    echo "⚠️  Application health check failed - please verify configuration"
fi

echo "✅ Deployment completed successfully!"
echo "Visit your domain to verify the application is working"
EOF

    chmod +x "$PACKAGE_DIR/scripts/deploy.sh"
    log_success "Deployment script created"
}

# Function to create package metadata
create_package_metadata() {
    log_info "Creating package metadata..."
    
    cat > "$PACKAGE_DIR/PACKAGE_INFO.json" << EOF
{
  "package_name": "weba-deployment-package",
  "version": "1.0.0",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "created_by": "$(whoami)",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "git_branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "php_version_required": ">=8.1",
  "mysql_version_required": ">=5.7",
  "files_included": [
    "public/",
    "src/",
    "config/",
    "migrations/",
    "admin/",
    "vendor/",
    "scripts/",
    ".env.example",
    "composer.json",
    "composer.lock"
  ],
  "deployment_notes": "Ready for production deployment. Follow DEPLOYMENT_INSTRUCTIONS.md"
}
EOF

    log_success "Package metadata created"
}

# Function to create ZIP archive
create_zip_archive() {
    log_info "Creating deployment ZIP archive..."
    
    cd "$PACKAGE_DIR"
    zip -r -q "../deploy_package.zip" .
    cd "$CURRENT_DIR"
    
    # Get file size
    FILE_SIZE=$(du -h deploy_package.zip | cut -f1)
    
    log_success "ZIP archive created: deploy_package.zip ($FILE_SIZE)"
}

# Function to restore original vendor directory
restore_original_vendor() {
    if [ -d "vendor_backup_temp" ]; then
        log_info "Restoring original vendor directory..."
        rm -rf vendor
        mv vendor_backup_temp vendor
        log_success "Original vendor directory restored"
    fi
}

# Function to validate package
validate_package() {
    log_info "Validating deployment package..."
    
    local errors=0
    
    # Check essential files
    essential_files=(
        "$PACKAGE_DIR/public/index.php"
        "$PACKAGE_DIR/src"
        "$PACKAGE_DIR/config/db.php"
        "$PACKAGE_DIR/migrations"
        "$PACKAGE_DIR/vendor/autoload.php"
        "$PACKAGE_DIR/.env.example"
        "$PACKAGE_DIR/composer.json"
    )
    
    for file in "${essential_files[@]}"; do
        if [ ! -e "$file" ]; then
            log_error "Missing essential file: $file"
            errors=$((errors + 1))
        fi
    done
    
    # Check PHP syntax in the package
    log_info "Checking PHP syntax in package..."
    find "$PACKAGE_DIR" -name "*.php" -not -path "*/vendor/*" -exec php -l {} \; > /dev/null 2>&1
    
    if [ $? -ne 0 ]; then
        log_error "PHP syntax errors found in package"
        errors=$((errors + 1))
    fi
    
    if [ $errors -eq 0 ]; then
        log_success "Package validation passed"
        return 0
    else
        log_error "Package validation failed with $errors errors"
        return 1
    fi
}

# Function to generate package report
generate_package_report() {
    log_info "Generating package report..."
    
    local report_file="deploy_package_report.txt"
    
    cat > "$report_file" << EOF
=== DEPLOYMENT PACKAGE REPORT ===
Generated: $(date)
Package Directory: $PACKAGE_DIR
Archive: deploy_package.zip

PACKAGE CONTENTS:
$(find "$PACKAGE_DIR" -type f | wc -l) files
$(du -sh "$PACKAGE_DIR" | cut -f1) total size
$(du -sh deploy_package.zip | cut -f1) compressed size

STRUCTURE:
$(tree "$PACKAGE_DIR" -L 2 2>/dev/null || find "$PACKAGE_DIR" -type d | head -20)

PHP FILES:
$(find "$PACKAGE_DIR" -name "*.php" | wc -l) PHP files
$(find "$PACKAGE_DIR" -name "*.php" -exec wc -l {} + | tail -1 | awk '{print $1}') total lines of PHP code

DEPENDENCIES:
$([ -f "$PACKAGE_DIR/composer.lock" ] && grep -c '"name"' "$PACKAGE_DIR/composer.lock" || echo "0") Composer packages

DEPLOYMENT READY: YES
EOF

    log_success "Package report saved to $report_file"
}

# Main execution
main() {
    log_info "Deployment packaging started at $(date)"
    
    # Pre-flight checks
    if [ ! -f "composer.json" ]; then
        log_error "composer.json not found. Are you in the right directory?"
        exit 1
    fi
    
    if ! command -v composer &> /dev/null; then
        log_error "Composer not found. Please install Composer first."
        exit 1
    fi
    
    # Execute packaging steps
    cleanup_old_backups
    backup_existing_package
    install_production_deps
    build_assets
    create_package_structure
    copy_essential_files
    create_deployment_instructions
    create_deployment_script
    create_package_metadata
    
    # Validate package before creating archive
    if validate_package; then
        create_zip_archive
        generate_package_report
        restore_original_vendor
        
        log_success "🎉 Deployment package created successfully!"
        log_info "📦 Package location: $PACKAGE_DIR/"
        log_info "📎 Archive location: deploy_package.zip"
        log_info "📋 Report: deploy_package_report.txt"
        log_info "📖 Instructions: $PACKAGE_DIR/DEPLOYMENT_INSTRUCTIONS.md"
        
    else
        log_error "Package validation failed. Please fix the issues and try again."
        restore_original_vendor
        exit 1
    fi
}

# Execute main function
main "$@"