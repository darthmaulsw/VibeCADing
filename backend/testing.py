from kittycad import KittyCAD
from kittycad.models import TextToCad
from kittycad.models import TextToCadResponse
from dotenv import load_dotenv
import json
import ast

load_dotenv()

def getit(id):
    client = KittyCAD()  # Uses KITTYCAD_API_TOKEN environment variable

    result: TextToCadResponse = client.ml.get_text_to_cad_part_for_user(id=id)


    return result

id = "3e8a8a9b-4dca-4ae9-918a-5e8716d5afd6"
id2 = "609f25bf-7768-4f79-85e8-ee1e40a3a307"
id3 = "be165a66-5bdf-4e4f-ab1b-7e535165d71b"
id4 = "173c3c7c-8161-45e4-b144-c130848b2d5f"
id5 = "51ed20d6-4baa-4a1d-a86f-b3db8bf2de4d"

if __name__=="__main__":
    body = getit(id5)
    l = json.loads(json.dumps(body.model_dump(), indent=2, default=str))
    print(l)
    b = l['outputs']['source.stl'].strip()
    actual = ast.literal_eval(b)
    with open('output.stl', 'wb') as f:
        f.write(actual)