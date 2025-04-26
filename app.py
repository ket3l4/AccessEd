from flask import Flask, request, jsonify
from flask_cors import CORS  # Import Flask-CORS
from google import genai
from google.genai import types
import requests
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

api_key = "AIzaSyBCn3moS9GLwusNtzNulesyirHvMqJEcWM"
client = genai.Client(api_key=api_key)

@app.route('/describe_image', methods=['GET'])
def describe_image():
    image_url = request.args.get('url')

    try:
        image_response = requests.get(image_url)
        image_response.raise_for_status()
        image_data = image_response.content

        # Use the updated model name
        model_name = "gemini-1.5-flash"

        # Ensure the API call is compatible with the new model
        response = client.models.generate_content(
            model=model_name,
            contents=[
                "Describe the image for someone with limited visuel abilities",
                types.Part.from_bytes(data=image_data, mime_type="image/png"),
            ]
        )
        return jsonify({"description": response.text})
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to fetch image: {e}"}), 400
    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"error": "An internal error occurred processing the image."}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
