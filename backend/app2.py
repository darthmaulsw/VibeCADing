from kittycad.models.text_to_cad_create_body import TextToCadCreateBody
from kittycad.models import TextToCad
from dotenv import load_dotenv
import asyncio
from dedalus_labs import AsyncDedalus, DedalusRunner
from prompts import specifications
import os
from kittycad import KittyCAD
from dedalus_labs.utils.streaming import stream_async
import json

load_dotenv()

"""def cad_from_prompt(prompt: str, output_format: str = "stl", kcl: bool = False):
    \"""Generate a CAD file from a prompt using KittyCAD/Zoo API.\"""
    api_token = os.getenv("KITTYCAD_API_TOKEN")  # or "ZOO_API_TOKEN"
    
    if not api_token:
        raise ValueError("API token not found in environment variables")
    
    url = f"https://api.zoo.dev/ai/text-to-cad/{output_format}"
    
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json"
    }
    
    params = {
        "kcl": str(kcl).lower()  # Convert boolean to lowercase string
    }
    
    data = {
        "project_name": "vibecad",
        "prompt": prompt
    }
    
    response = requests.post(url, headers=headers, params=params, json=data)
    response.raise_for_status()  # Raise exception for bad status codes
    
    return response.json()"""

def cad_from_prompt(prompt: str) -> TextToCad:
    """Generate a CAD STL file from a prompt using KittyCAD's Text-to-CAD model."""
    client = KittyCAD()

    result: TextToCad = client.ml.create_text_to_cad(
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

async def get_cad(user_prompt):
    client = AsyncDedalus()
    runner = DedalusRunner(client)
    specs = specifications(user_prompt)
    print(specs)
    result = await runner.run(
        input=f"Generate the specifications from the following prompt: {specs}, then handoff to Gemini to write a short confirmation sentence that you have generated a CAD file that meets the user's constraints. Output both the confirmation message and the specifications, separated by five newline characters.",
        model=["openai/gpt-5", "gemini-2.5-flash"],
        mcp_servers=["windsor/brave-search-mcp"],
        stream=False,
    )
    return result.final_output

if __name__ == "__main__":
    ret = asyncio.run(get_cad("make me a traffic cone"))
    print(ret)
    sp = ret.split("\n\n\n\n\n")
    print(sp)
    confirmation = sp[0]
    specprompt = sp[-1]
    print(specprompt)
    res = cad_from_prompt(specprompt)
    print(res)