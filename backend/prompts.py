def mkprompt(p: str) -> str:
    return f"""
        Help me write a role-based prompt to generate an OpenSCAD code for the user's request. 
        
        YOU NEED TO USE MCAD LIBRARIES BUILT INTO OPENS CAD WHENEVER APPROPRIATE; ALL ITEMS MUST BE ATTACHED TOGETHER, AND THERE SHOULD NOT BE ANY RANDOM FLOATING BODIES.
        I CANNOT EMPHASIZE THIS ENOUGH.
        
        The SCAD code MUST use MCAD and other SCAD libraries built into OpenSCAD as much as possible to make the build more polished; moreover, all items must be attached together and there should not be any random floating bodies. 
        This is EXTREMELY IMPORTANT that the SCAD MUST 100% USE MCAD and other libraries. 
        
        Also, make sure the prompt specifies that the only return should be OpenSCAD code, with no supporting text or dialogue. 
        
        Here's the user's request: {p}
        
        Here's an example of a good prompt: 
        
    			(Give me an OpenSCAD file of a cone:

        		Make sure the cone is realistic and looks like an actual traffic cone. Refer to at least 10 images online of basic orange traffic cones with two striped horizontal white stripes. The inside must be hollow and the bottom base must be square. 
        
        IMPORTANT: the only return should be OpenSCAD code, with no supporting text or dialogue. 

        ***
        IMPORTANT: Make sure to use  MCAD libraries built into OpenSCAD whenever appropriate to build this cone. All items must be attached together, there should not be random floating bodies.)
        WHENEVER YOU WANT TO IMPORT AN MCAD LIBRARY, MAKE SURE IT ACTUALLY EXISTS IN https://github.com/openscad/MCAD
        I DONT WANT ANY HALLUCINATED LIBRARIES IN THE OPENSCAD CODE.
        YOU HAVE HAVE HAVE TO USE AT LEAST ONE MCAD LIBRARY WHEN CREATING THE OBJECT
        HERE IS THE GIT LINK SO YOU CAN UNDERSTAND WHAT I MEAN BY MCAD LIBRARY: https://github.com/openscad/MCAD 
        ***
        
        If this specific item is found online, use specific reference OpenSCAD files when possible. 
        Ensure that the dimensions are small enough (at most they should be <25) so that they can be compiled. 

        IMPORTANT: MAKE SURE TO FIND REFERENCE IMAGES FIRST BEFORE OUTLINING THE PROMPT.
        MAKE SURE TO CAPTURE ALL THE CAVEATS THAT MAKE AN ITEM WHAT IT IS, CAPTURE ALL DETAILS THAT WOULD MAKE THE ITEM FUNCTION AS INTENDED.
        AND APPEAR AS INTENDED.

        FINAL NOTICE: MAKE SURE TO REMOVE THE FIRST LINE IF IT CONTAINS ANYTHING LIKE "```openscad" OR "```"
        AND THE LAST LINE IF IT CONTAINS "```"

        MAKE SURE NOT TO WRAP THE FINAL OPENSCAD CODE IN ANY MARKDOWN OR CODE BLOCKS. KEEP IT PLAIN TEXT.

    """

def editprompt(p: str, fix: str) -> str:
	return f"""
		Here is the user's feedback on what needs to be fixed in the generated OpenSCAD code:
		{fix}
            
        Here is the original openScad code {p} that was generated based on the user's first request.
        
        I WANT YOU TO UNDERSTAND THE OLD CODE FULLY, MAKE CHANGES ONLY TO WHAT THE USER HAS REQUESTED
        USE SONAR TO HELP YOU UNDERSTAND THE OPENSCAD CODE IF NEEDED.

		Based on this feedback, help me write a new and improved role-based prompt to generate an updated OpenSCAD code that addresses the user's concerns. 

		Make sure to keep all the original requirements from the first iteration (MAKE SURE TO UNDERSTAND WHAT THE OPENSCAD CODE IS DOING), but also address the new issues raised by the user. 

		REMEMBER TO USE MCAD LIBRARIES BUILT INTO OPENS CAD WHENEVER APPROPRIATE; ALL ITEMS MUST BE ATTACHED TOGETHER, AND THERE SHOULD NOT BE ANY RANDOM FLOATING BODIES.
		ALSO, MAKE SURE THE PROMPT SPECIFIES THAT THE ONLY RETURN SHOULD BE OPENS CAD CODE, WITH NO SUPPORTING TEXT OR DIALOGUE.

		HERE IS THE GIT LINK SO YOU CAN UNDERSTAND WHAT I MEAN BY MCAD LIBRARY: https://github.com/openscad/MCAD  """