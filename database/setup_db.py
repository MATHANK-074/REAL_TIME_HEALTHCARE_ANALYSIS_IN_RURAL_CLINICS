import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load env variables from root directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

def main():
    db_url = os.getenv("DATABASE_URL", "mysql+pymysql://root:@localhost:3306/rural_healthcare")
    print(f"Target DATABASE_URL: {db_url}")
    
    # 1. Connect to base MySQL server first to verify/create database
    # Split database name from the URL
    base_url = db_url.rsplit('/', 1)[0] + '/'
    print(f"Connecting to MySQL server at {base_url} to ensure database exists...")
    
    try:
        engine = create_engine(base_url)
        with engine.connect() as conn:
            # We must use transactional execution or simple raw execute depending on DB
            conn.execute(text("CREATE DATABASE IF NOT EXISTS rural_healthcare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"))
        print("Database 'rural_healthcare' verified/created.")
    except Exception as e:
        print(f"Failed to verify/create database. Ensure MySQL is running on localhost:3306. Error: {e}")
        sys.exit(1)
        
    # 2. Connect directly to rural_healthcare and run SQL statements
    print(f"Connecting to database at {db_url}...")
    try:
        db_engine = create_engine(db_url)
    except Exception as e:
        print(f"Failed to create database engine for URL {db_url}: {e}")
        sys.exit(1)

    def run_sql_file(filepath):
        print(f"Running SQL file: {filepath}")
        if not os.path.exists(filepath):
            print(f"Error: SQL file not found at {filepath}")
            sys.exit(1)
            
        with open(filepath, 'r', encoding='utf-8') as f:
            sql_content = f.read()
            
        # Parse statements separated by semicolons, ignoring comments and empty lines
        statements = []
        current_statement = []
        for line in sql_content.split('\n'):
            stripped = line.strip()
            if not stripped or stripped.startswith('--') or stripped.startswith('#'):
                continue
            current_statement.append(line)
            if stripped.endswith(';'):
                statements.append('\n'.join(current_statement))
                current_statement = []
                
        # If there's any remaining code without a trailing semicolon
        if current_statement:
            rem = '\n'.join(current_statement).strip()
            if rem:
                statements.append(rem)

        # Execute statements
        with db_engine.connect() as conn:
            trans = conn.begin()
            try:
                for stmt in statements:
                    stmt_text = stmt.strip()
                    if stmt_text:
                        # Skip USE statements as sqlalchemy is already connected to target DB
                        if stmt_text.upper().startswith("USE "):
                            continue
                        conn.execute(text(stmt_text))
                trans.commit()
                print(f"Successfully executed {filepath}")
            except Exception as e:
                trans.rollback()
                print(f"Failed to execute statement in {filepath}: {e}")
                print(f"Offending statement:\n{stmt_text}")
                raise e

    # Apply schema
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    run_sql_file(schema_path)

    # Apply seed data
    seed_path = os.path.join(os.path.dirname(__file__), "seed.sql")
    run_sql_file(seed_path)

    print("Database initialization and seeding completed successfully!")

if __name__ == "__main__":
    main()
