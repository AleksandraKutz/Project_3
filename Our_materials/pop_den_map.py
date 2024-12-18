!pip install flask_cors
from flask import Flask, jsonify, render_template
from flask_cors import CORS
from sqlalchemy import create_engine
from sqlalchemy.ext.automap import automap_base
from sqlalchemy.orm import sessionmaker
import os

app = Flask(__name__)

CORS(app)

# Get the DATABASE_URL environment variable set by Render
database_url = os.getenv ("postgresql://postgres:postgres@localhost:5432/healthcare_deserts")

# Uncomment and replace with your local database URL if necessary:
database_url = "postgresql://postgres:postgres@localhost:5432/healthcare_deserts"

# Check if the DATABASE_URL is available, if not raise an error
if not database_url:
    raise ValueError("DATABASE_URL environment variable is not set.")

engine = create_engine(database_url)

Base = automap_base()

Base.prepare(autoload_with=engine)

Demographics = Base.classes.demographics
Population = Base.classes.population


@app.route("/")
def home():
    return render_template("home.html")


@app.route("/map")
def map_page():
    return render_template("map.html")


@app.route("/heatmap")
def heatmap_page():
    return render_template("heatmap.html")


@app.route("/plots")
def plots_page():
    return render_template("3_plots.html")


@app.route("/api/v1.0/locations")
def get_locations():
    # Create a new session to interact with the database
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Query to get data from both demographics and population tables
        results = session.query(
            Demographics.latitude,
            Demographics.longitude,
            Demographics.count_of_licensees,
            #Demographics.coverage_rate,
            Demographics.zip_code,
            Population.population_under_18_years,
            #Demographics.poverty_rate,
            #Demographics.insurance_coverage_status,  
            #Demographics.family_median_income,
            Population.population_density_per_sq_mile
        ).join(
            Population, Demographics.zip_code == Population.zip_code
        ).filter(
            Population.population_density_per_sq_mile != None,  # - population_density_per_sq_mile is not None
            Population.population_density_per_sq_mile != 0,     # - population_density_per_sq_mile is not 0
            Population.population_density_per_sq_mile > 0  # - population_density_per_sq_mile is more than 0
        ).all()

        locations = []
        for latitude, longitude, count_of_licensees, population_density in results:
            if count_of_licensees > 0:
                # Calculate the children-to-doctor ratio
                children_to_doctor_ratio = population_under_18_years / count_of_licensees
            else:
                children_to_doctor_ratio = 0  # Set to 0 or handle as needed if doctor_count is None or 0

            # Append data for each location
            locations.append({
                "Latitude": latitude,
                "Longitude": longitude,
                "Children_to_Doctor_Ratio": children_to_doctor_ratio,
                #"Coverage_Rate": coverage_rate,
                #"Zip_Code": zip_code,
                #"Poverty_Rate": poverty_rate,
                #"Insurance_Coverage_Status": insurance_coverage_status, 
                #"Family_Median_Income": family_median_income,
                "Population_Density": population_density_per_sq_mile
            })

        # Return the data as JSON
        return jsonify(locations)

    except Exception as e:
        # If something goes wrong, return an error message in JSON format
        return jsonify({"error": str(e)})

    finally:
        # Close the session to prevent memory leaks and ensure cleanup
        session.close()


# Run the Flask app
if __name__ == "__main__":
    app.run(debug=False, host='0.0.0.0', port=10000)