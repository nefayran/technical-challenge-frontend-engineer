"""ascii2d tokens and the shipped CLASSIC board.

This mirrors the wire format defined by ``frontend/game/engine/ascii2d.ts`` so
generated and stored boards parse cleanly in the engine. Each cell is a 2-char
pair on newline-separated rows:

    "##"   wall
    "  "   empty
    ". "   pellet
    "O "   power pellet
    "P<D>" player spawn, <D> is direction U/D/L/R
    "G<D>" ghost spawn, <D> is direction U/D/L/R

The backend treats a level as opaque ascii2d text; only the generator needs to
emit these tokens.
"""

WALL = "##"
EMPTY = "  "
PELLET = ". "
POWER = "O "

# Direction suffix characters as understood by ascii2d.ts.
UP = "U"
DOWN = "D"
LEFT = "L"
RIGHT = "R"


def player(direction: str) -> str:
    return "P" + direction


def ghost(direction: str) -> str:
    return "G" + direction


# Verbatim copy of CLASSIC from frontend/game/engine/ascii2d.ts. Kept here so
# the backend has a known-good level to seed in-memory storage with on startup.
CLASSIC = """
########################################################
##O PR. . . . . . . . . . ####. . . . . . . . . . . O ##
##. ########. ##########. ####. ##########. ########. ##
##. ########. ##########. ####. ##########. ########. ##
##. ########. ##########. ####. ##########. ########. ##
##. . . . . . . . . . . . . . . . . . . . . . . . . . ##
##. ########. ####. ################. ####. ########. ##
##. ########. ####. ################. ####. ########. ##
##. . . . . . ####. . . . ####. . . . ####. . . . . . ##
############. ##########. ####. ##########. ############
          ##. ##########. ####. ##########. ##
          ##. ####. . . . . . . . . . ####. ##
############. ####. ######    ######. ####. ############
. . . . . . . . . . ##GR  GUGR  GL##. . . . . . . . PR. 
############. ####. ################. ####. ############
          ##. ####. . . . PL. . . . . ####. ##
          ##. ####. ################. ####. ##
############. ####. ################. ####. ############
##. PU. . . . . . . . . . ####. . . . . . . . . . . . ##
##. ########. ##########. ####. ##########. ########. ##
##. ########. ##########. ####. ##########. ########. ##
##. . . ####. . . . . . . . . . . . . . . . ####. . . ##
######. ####. ####. ################. ####. ####. ######
######. ####. ####. ################. ####. ####. ######
##. . . . . . ####. . . . ####. . . . ####. . . . . . ##
##. ####################. ####. ####################. ##
##. ####################. ####. ####################. ##
##O . . . . . . . . . . . PR. . . . . . . . . . . . O ##
########################################################
"""
