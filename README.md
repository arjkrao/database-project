# Instructions to Deploy and Run
### Prerequisites:
- Git
- Python 3.8+ (python3 and pip are installed)
- MySQL Server
- Local MySQL instance running (e.g., via Homebrew on Mac or standard MySQL installer / XAMPP / WAMP on Windows)

The following steps provide a guide to deploy and test our application on a single local machine starting from cloning the repository from GitHub.
## 1. Clone the Repository
Open your terminal and clone the repository onto your machine:

```git clone https://github.com/arjkrao/database-project.git```

Then cd into it:

```cd database-project```

## 2. Set up the Database
Start up the local MySQL server and log in as root
```mysql -u root -p```

Then create the testing database and any necessary user accounts by running these SQL commands in the MySQL shell

```sql
CREATE DATABASE `db-proj-test`;

-- Create Admin User
CREATE USER 'db-proj-test-adm'@'localhost' IDENTIFIED BY '[REFER TO ENV]';
GRANT ALL PRIVILEGES ON `db-proj-test`.* TO 'db-proj-test-adm'@'localhost';

-- Create Default/App User
CREATE USER 'db-proj-test-usr'@'localhost' IDENTIFIED BY '[REFER TO ENV]';
GRANT ALL PRIVILEGES ON `db-proj-test`.* TO 'db-proj-test-usr'@'localhost';

-- Create Root/Dev User mapped in .env
CREATE USER 'db-proj-test'@'localhost' IDENTIFIED BY '[REFER TO ENV]';
GRANT ALL PRIVILEGES ON `db-proj-test`.* TO 'db-proj-test'@'localhost';

FLUSH PRIVILEGES;
```

Then import the sample database given this link [REDCATED schema.sql]. Insert this file into the root folder.

Then execute the following commands to import it into the MySQL server:

```mysql -u db-proj-test -p db-proj-test < schema.sql```

**Note**: Enter `[REFER TO ENV]` when prompted for password

## 3. Configure Environment Files
We will configure the `.env` file in the root of the project.

Copy and paste the `.env` and the `client_secret.json` files.

Change the IP of `HOSTNAME` to be your local machine. By default, you should change it to `127.0.0.1`.

## 4. Install Dependencies
Run the following commands to create a virtual environment and install the required Python packages. Follow the instructions as per your machine’s operating system.

On Mac/Linux:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```


On Windows:
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 5. Run the App
With the database running locally and the environment files configured, we can finally start the Flask application.

Run the following command:
```
python3 app.py
```

**Note**: On Windows, you may use `python app.py`

Then, open a web browser and navigate to `http://127.0.0.1:5000` to view the application.
