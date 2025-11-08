from kittycad.models.file_export_format import FileExportFormat
from kittycad.models.text_to_cad_create_body import TextToCadCreateBody
from kittycad.models import TextToCad
from typing import Union, Any, Optional, List, Tuple
from kittycad.types import Response
from dotenv import load_dotenv
import asyncio
from dedalus_labs import AsyncDedalus, DedalusRunner
from prompts import specifications
import threading
from flask import Flask, jsonify
import os
from kittycad import KittyCAD

load_dotenv()

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
        stream=False
    )
    ret = result.final_output
    return ret

if __name__ == "__main__":
    ret = asyncio.run(get_cad("make me a pen holder that can clip onto my desk and hold at least 5 pens"))
    sp = ret.split("\n\n\n\n")
    confirmation = sp[0]
    specprompt = sp[1]
    res = cad_from_prompt(specprompt)
    print(res)