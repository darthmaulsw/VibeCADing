from typing import Union, Any, Optional, List, Tuple
from dotenv import load_dotenv
import asyncio
from dedalus_labs import AsyncDedalus, DedalusRunner
from prompts import specifications
import threading
from flask import Flask, jsonify

load_dotenv()

client = AsyncDedalus()
runner = DedalusRunner(client)

async def cad_from_prompt(prompt: str) -> TextToCad:
    """Generate a CAD STL file from a prompt using KittyCAD's Text-to-CAD model."""
    client = AsyncClient()

    result: TextToCad = await client.ml.create_text_to_cad(
        output_format="stl",
        kcl=False,
        body=TextToCadCreateBody(
            project_name="vibecad",
            prompt=prompt,
        )
    )

    body: TextToCad = result
    print(body)
    return result

async def confirmation_message(prompt: str) -> str:
    passing = f"""
        You are a professional CAD designer. Given the following user prompt, generate a short confirmation message that you have satisfied their constraints and generated a CAD file. 

        Here is the user request:
        {prompt}
    """
    result = await runner.run(
        input=passing,
        model="gemini-2.5-flash",
    )
    return result.final_output

async def get_cad(user_prompt):
    specs = specifications(user_prompt)
    print(specs)
    result = await runner.run(
        input=f"Generate the specifications from the following prompt, then send the output to the cad_from_prompt tool. Output the response. Here are the specs: {specs}",
        model="openai/gpt-5",
        tools=[cad_from_prompt]
    )
    print(result.final_output)
    return result.final_output

app = Flask(__name__)

def background_cad(user_prompt):
    asyncio.run(get_cad(user_prompt))

#@app.route("/generate", methods=["POST"])
def generate(prompt):
    thread = threading.Thread(target=background_cad, args=(prompt,))
    thread.start()

    confirmation = asyncio.run(confirmation_message(prompt))
    return confirmation

@app.route("/")
def index():
    return "running"

if __name__ == "__main__":
    print(generate("Make me a pen holder that can clip onto the side of a desk and hold at least 5 pens."))