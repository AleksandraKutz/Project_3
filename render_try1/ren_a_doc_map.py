from flask import Flask, jsonify, render_template
from flask_cors import CORS
from sqlalchemy import create_engine
from sqlalchemy.ext.automap import automap_base
from sqlalchemy.orm import sessionmaker
import os

app = Flask(__name__)

# Enable CORS for all origins (only for development or specific cases)
CORS(app)

# Get the DATABASE_URL environment variable set by Render
database_url = os.getenv("DATABASE_URL")

# Check if the DATABASE_URL is available, if not raise an error
if not database_url:
    raise ValueError("DATABASE_URL environment variable is not set. Please check the configuration.")

# Connect to the PostgreSQL database using the URL from the environment variable
engine = create_engine(database_url)

# Prepare the database for automapping
Base = automap_base()

# Reflect the tables from the database
Base.prepare(autoload_with=engine)

# Access the 'demographics' table (automatically mapped)
Demographics = Base.classes.demographics

# Route for the home page (just a welcome message)
@app.route("/")
def home():
    return """
    <h1>Welcome to the Group 1 Project!</h1>
    <p>The Socioeconomic Factors Behind Healthcare Deserts.</p>
    <p>Visit <a href='/api/v1.0/locations'>/api/v1.0/locations</a> for data in JSON format.</p>
    <p>Explore our interactive map to see how the different parameters are laid out across California. <a href='/map'>/map</a> to see the map of locations.</p>
    """

# Route for the map page
@app.route("/map")
def map_page():
    return render_template("ren_a_doc_map.html")  # This will load the map page from the templates folder

# API route to return data in JSON format
@app.route("/api/v1.0/locations")
def get_locations():
    # Create a new session to interact with the database
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Query the 'demographics' table to get latitude, longitude, doctor count, and coverage rate
        results = session.query(
            Demographics.latitude,
            Demographics.longitude,
            Demographics.count_of_licensees,
            Demographics.coverage_rate 
        ).filter(
            Demographics.coverage_rate != None,  # Exclude rows with None in coverage_rate
            Demographics.coverage_rate != 0,     # Exclude rows where coverage_rate is 0
            Demographics.count_of_licensees > 0 # Exclude rows where doctor count is 0
        ).all()  # Apply the filters

        locations = []
        # Loop through the results and structure the data as needed
        for latitude, longitude, count_of_licensees, coverage_rate in results:
            locations.append({
                "Latitude": latitude,
                "Longitude": longitude,
                "Count_of_Licensees": count_of_licensees,
                "Coverage_Rate": coverage_rate  # Add coverage_rate to the result
            })

        # Return the data as JSON
        return jsonify(locations)

    except Exception as e:
        # If something goes wrong, return an error message
        return jsonify({"error": str(e)})

    finally:
        # Close the session to prevent memory leaks
        session.close()

if __name__ == "__main__":
    # In production, do not set debug to True.
    app.run(debug=False, host='0.0.0.0', port=10000)