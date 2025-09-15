In the first 25 turns, this bot will move its armies to the territories 
immediately around it. Armies cannot be moved from a tile until there are
more than 1 armies on that tile. This means that:

on the first turn that there are more than 1 armies on the general tile,
this bot will attempt to move armies to the north if
to the north is an empty tile (not a mountain, tower, or village).

on the next turn that there are more than 1,
this bot will attempt to move armies to the east if
to the north is an empty tile (not a mountain, tower, or village).

continue to the south and west.

After that it will target the tiles to its diagonals. This will require a simple
path finding algorithm. It's use is simple for finding the diagonals now, but once
the immediate tiles surrounding the general are conquered, it will need to be used
to expand outward to the north again, then to the next tile to the east, until
it reaches the corner tile, the diagonal tile out to the northeast, and then 
conquering downward along the east frontline. Its frontline should expand
outward in a spiral until the 25th turn. Just before the 25th turn, it should
have a maximum number of tiles conquered all with only 1 army on each tile.

On the 25th turn, each conquered tile gets 1 additional army.
This bot will then activate its general tile and begin moving armies there in a
spiral fashion outward collecting all the surplus armies on all the conquered tiles.
At the end of this journey spiral outward from the general tile after turn 25,
it should have one tile with all the surplus armies thus far gathered onto one tile
along the frontline facing the center of the map. This will likely take up until
turn 50, but may happen faster. 

At this point, the objective is to journey towards the center tile in search
of a tower to conquer or city to capture along the way.

- If a tower or city is found, use the path finding algorithm to move armies from the 
tile with the highest amount of armies toward the target (tower or city). The path finding
algorithm should be configured to be able to find the path with the most armies along the way
(to maximize attack force) or the fastest route (to maximize speed). Continue moving
armies toward the target until it is conquered.

...to be continued