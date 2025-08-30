"""
Migration script to add missing fields to communication models
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db
from sqlalchemy import text

def migrate():
    with app.app_context():
        try:
            # Check if columns exist first
            inspector = db.inspect(db.engine)
            
            # Get existing columns for email_providers
            email_columns = [col['name'] for col in inspector.get_columns('email_providers')]
            
            # Add current_day_sent to email_providers if it doesn't exist
            if 'current_day_sent' not in email_columns:
                db.session.execute(text("ALTER TABLE email_providers ADD COLUMN current_day_sent INTEGER DEFAULT 0"))
                print("✅ Added current_day_sent to email_providers")
            
            # Add current_month_sent to email_providers if it doesn't exist
            if 'current_month_sent' not in email_columns:
                db.session.execute(text("ALTER TABLE email_providers ADD COLUMN current_month_sent INTEGER DEFAULT 0"))
                print("✅ Added current_month_sent to email_providers")
            
            # Get existing columns for sms_providers
            sms_columns = [col['name'] for col in inspector.get_columns('sms_providers')]
            
            # Add current_day_sent to sms_providers if it doesn't exist
            if 'current_day_sent' not in sms_columns:
                db.session.execute(text("ALTER TABLE sms_providers ADD COLUMN current_day_sent INTEGER DEFAULT 0"))
                print("✅ Added current_day_sent to sms_providers")
            
            # Add current_month_sent to sms_providers if it doesn't exist
            if 'current_month_sent' not in sms_columns:
                db.session.execute(text("ALTER TABLE sms_providers ADD COLUMN current_month_sent INTEGER DEFAULT 0"))
                print("✅ Added current_month_sent to sms_providers")
            
            # Add sender_email to email_providers if it doesn't exist
            if 'sender_email' not in email_columns:
                db.session.execute(text("ALTER TABLE email_providers ADD COLUMN sender_email VARCHAR(200)"))
                print("✅ Added sender_email to email_providers")
            
            db.session.commit()
            print("✅ Migration completed successfully!")
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Migration failed: {e}")

if __name__ == "__main__":
    migrate()
