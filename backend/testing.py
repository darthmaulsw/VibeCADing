from dotenv import load_dotenv
import asyncio
from dedalus_labs import AsyncDedalus, DedalusRunner, Dedalus
from prompts import editprompt
import os
from dedalus_labs.utils.streaming import stream_sync
import anthropic
from flask import Flask, jsonify
from pathlib import Path

SCAD_PATH = (Path(__file__).resolve().parents[1] / "output.scad")
scad_code = SCAD_PATH.read_text(encoding="utf-8")

load_dotenv()

client2 = anthropic.Anthropic(api_key=os.getenv("CLAUDE_API_KEY"))

def gen_cad(p):
    response =  client2.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=20000,
        messages=[{"role": "user", "content": p}]
    )
    content =  response.content
    code_blocks = [block.text for block in content if hasattr(block, "text")]
    full_text = "\n".join(code_blocks)
    
    with open('outputIterated.scad', 'w', encoding='utf-8') as f:
        f.write(full_text)


async def iterate_cad(user_prompt, scad_code):
    client = Dedalus()
    runner = DedalusRunner(client)
    result =  runner.run(
        input=f"""Here is the user's fix to the old request: {user_prompt}
                Here is the generated openSCAD code of the original request: {scad_code}
                
                Analyze the openSCAD code and see if it meets all the requirements of the user's original request.
                If it does, respond with "The openSCAD code meets all the requirements."
                If it does not, identify the shortcomings and generate a new prompt to fix the issues.
                Use editprompt to create a new prompt that addresses the shortcomings and improves the openSCAD code.
                --- pass in the old openSCAD code and the user's fix into editprompt to make the new prompt --- IMPORTANT

                THEN, use gen_cad to generate a new openSCAD code based on the new prompt.
                
                MAKE SURE TO FOLLOW ALL THE GUIDELINES ABOUT USING MCAD LIBRARIES BUILT INTO OPENS CAD WHENEVER APPROPRIATE; 
                ALL ITEMS MUST BE ATTACHED TOGETHER, AND THERE SHOULD NOT BE ANY RANDOM FLOATING BODIES.
                
                ALSO, MAKE SURE THE PROMPT SPECIFIES THAT THE ONLY RETURN SHOULD BE OPENS CAD CODE, WITH NO SUPPORTING TEXT OR DIALOGUE.
                
                THE NEW OPENSCAD CODE SHOULD BE WRITTEN INTO A FILE VIA gen_cad
                
                MAKE SURE THE ONLY THING PASSSED INTO GEN_CAD IS THE PROMPT FOR CAD GENERATION
                THE FULL_TEXT IN GEN CAD SHOULD NOT BE WRITTEN TO THE SCAD FILE, ONLY THE OPEN SCAD CODE

                YOU NEED TO WAIT UNTIL gen_cad HAS FINISHED WRITING THE FILE BEFORE YOU FINISH YOUR RESPONSE

                ADDITIONALLY, IN THE output.scad FILE MAKE SURE TO REMOVE THE FIRST LINE IF IT CONTAINS ANYTHING LIKE "```openscad" OR "```"
                AND THE LAST LINE IF IT CONTAINS "```"
                """,
        model=["openai/gpt-5-mini","claude-sonnet-4-20250514"],
        mcp_servers=["windsor/brave-search-mcp", 'akakak/sonar', 'windsor/context7'],
        tools = [gen_cad, editprompt, ],
        stream = True,
        verbose= True,
    )
    stream_sync(result)
    print()


if __name__=="__main__":
    asyncio.run(iterate_cad("The lighter cap is not attached to the top of the body, make sure it is attached and the lighter looks realistic", scad_code))
