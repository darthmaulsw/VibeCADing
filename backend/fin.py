from dotenv import load_dotenv
import asyncio
from dedalus_labs import AsyncDedalus, DedalusRunner
from prompts import mkprompt
import os
from dedalus_labs.utils.streaming import stream_async
import anthropic

load_dotenv()

client2 = anthropic.Anthropic(api_key=os.getenv("CLAUDE_API_KEY"))

def gen_cad(p):
    response = client2.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=20000,
        messages=[{"role": "user", "content": p}]
    )
    content = response.content
    code_blocks = [block.text for block in content if hasattr(block, "text")]
    full_text = "\n".join(code_blocks)
    return full_text

async def get_cad(user_prompt):
    client = AsyncDedalus()
    runner = DedalusRunner(client)
    p = mkprompt(user_prompt)
    print(p)
    result = await runner.run(
        input=f"Generate the instructions according to the following prompt {p}, then  write a short confirmation sentence that you have generated a CAD file that meets the user's constraints. Output both the confirmation message and the specifications, separated by five newline characters.",
        model=["openai/gpt-5-mini"],
        mcp_servers=["windsor/brave-search-mcp"],
        stream=False,
    )
    return result.final_output

async def shit(crap):
    fp = await get_cad(crap)
    print(fp)
    gc = gen_cad(fp)
    print("==============================================\n==========================================")
    print(gc)
    return gc
    
if __name__=="__main__":
    pp = "a gaming mouse"
    gc = asyncio.run(shit(pp))
    with open('output.scad', 'w') as f:
        f.write(gc)