#!/usr/bin/env python3
"""
Database reset script to fix relationship issues
"""

from app import app
from extensions import db
from models import User, ISP, Customer, MikrotikDevice, RadiusSession
import os

def reset_database():
    """Reset the database and recreate all tables"""
    with app.app_context():
        print("Dropping all tables...")
        db.drop_all()
        
        print("Creating all tables...")
        db.create_all()
        
        print("Database reset completed successfully!")
        
        # Create a default admin user
        from werkzeug.security import generate_password_hash
        from datetime import datetime
        
        # Create default ISP
        default_isp = ISP(
            name='Default ISP',
            company_name='Default Company',
            email='admin@default.com',
            api_key='default_api_key_12345',
            is_active=True
        )
        db.session.add(default_isp)
        db.session.commit()
        
        # Create default admin user
        admin_user = User(
            email='admin1@infora.com',
            password_hash=generate_password_hash('admin123'),
            first_name='Admin',
            last_name='User',
            role='admin',
            is_active=True,
            isp_id=default_isp.id
        )
        db.session.add(admin_user)
        db.session.commit()
        
        print(f"Created default ISP: {default_isp.name}")
        print(f"Created admin user: {admin_user.email}")
        print("Database initialization completed!")

if __name__ == '__main__':
    reset_database()
