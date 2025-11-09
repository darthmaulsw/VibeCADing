from dotenv import load_dotenv
import asyncio
from dedalus_labs import AsyncDedalus, DedalusRunner, Dedalus
from prompts import mkprompt
import os
from dedalus_labs.utils.streaming import stream_sync
import anthropic

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
    
    with open('output.scad', 'w') as f:
        f.write(full_text)

async def get_cad(user_prompt):
    client = Dedalus()
    runner = DedalusRunner(client)
    # p = mkprompt(user_prompt)
    # print(p)
    result =  runner.run(
        input=f"""use mkprompt to make a proper prompt for cad generation based on this user request: {user_prompt}
                then use gen_cad and pass in the prompt you made to generate the openSCAD code for the user request
                use all tools available to you to make the best description of the cad model possible, 
                make the prompt very detailed so that the generated cad model is as accurate as possible to the user request
                make sure to mention in the prompt to use MCAD libraries built into OpenSCAD whenever appropriate; moreover, all items must be attached together and there should not be any random floating bodies.
                also, make sure the prompt specifies that the only return should be OpenSCAD code, with no supporting text or dialogue.
                
                the openScad code should be stored and not returned into the terminal. 
                THE OPENSCAD CODE SHOULD BE WRITTEEN INTO A FILE VIA gen_cad

                YOU NEED TO WAIT UNTIL gen_cad HAS FINISHED WRITING THE FILE BEFORE YOU FINISH YOUR RESPONSE

                ADDITIONALLY, IN THE output.scad FILE MAKE SURE TO REMOVE THE FIRST LINE IF IT CONTAINS ANYTHING LIKE "```openscad" OR "```"
                AND THE LAST LINE IF IT CONTAINS "```"
                """,
        model=["openai/gpt-5-mini","claude-sonnet-4-20250514"],
        tools = [gen_cad, mkprompt, ],
        mcp_servers=["windsor/brave-search-mcp", 'akakak/sonar', 'windsor/context7'],
        stream=True,
        verbose=True,
    )
    stream_sync(result)
    print()
    
# async def writeToFile(text):
#     with open('output.scad', 'w') as f:
#         f.write(text)
    
if __name__=="__main__":
    # pp = "a gaming mouse"
    asyncio.run(get_cad("Coffee mug"))
    # with open('output.scad', 'w') as f:
    #     f.write(gc)