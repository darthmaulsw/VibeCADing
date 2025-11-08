from kittycad import KittyCAD
from kittycad.models import TextToCad
from kittycad.models import TextToCadResponse
from dotenv import load_dotenv
import json

load_dotenv()

def getit(id):
    client = KittyCAD()  # Uses KITTYCAD_API_TOKEN environment variable

    result: TextToCadResponse = client.ml.get_text_to_cad_part_for_user(id=id)


    return result

id = "3e8a8a9b-4dca-4ae9-918a-5e8716d5afd6"
id2 = "609f25bf-7768-4f79-85e8-ee1e40a3a307"

if __name__=="__main__":
    body = getit(id2)
    print(json.dumps(body.model_dump(), indent=2, default=str))