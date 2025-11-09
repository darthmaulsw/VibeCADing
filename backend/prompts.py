def mkprompt(p: str) -> str:
    return f"""
        Help me write a prompt for Claude to generate an OpenSCAD code for the user's request. 
        
        Ensure that the prompt includes an instruction to use MCAD or other SCAD libraries built into OpenSCAD as much as possible to make the build more polished; moreover, all items must be attached together and there should not be any random floating bodies. 
        
        Also, make sure the prompt specifies that the only return should be OpenSCAD code, with no supporting text or dialogue. 
        
        Here's the user's request: {p}
        
        Here's an example of a good prompt: 
        
        (Give me an OpenSCAD file of a cone:

        Make sure the cone is realistic and looks like an actual traffic cone. Refer to at least 10 images online of basic orange traffic cones with two striped horizontal white stripes. The inside must be hollow and the bottom base must be square. 
        
        IMPORTANT: the only return should be OpenSCAD code, with no supporting text or dialogue. 

        IMPORTANT: Make sure to use MCAD libraries built into OpenSCAD whenever appropriate to build this cone. All items must be attached together, there should not be random floating bodies.)
        
        If this specific item is found online, use specific reference OpenSCAD files when possible. 
        
        Ensure that the dimensions are small enough (at most they should be <25) so that they can be compiled. 

        
        
        IMPORTANT: MAKE SURE TO FIND REFERENCE IMAGES FIRST BEFORE OUTLINING THE PROMPT.
    """