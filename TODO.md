# TODO

## Defects to fix  
- Enemy generals spawn to close to each other. Update general spawn logic to
	balance space between all other generals and edges of the map.
- All special tiles (lookout towers, generals, cities) look flat
	with the exception of the general tile which has a shiny gold surface.
	Add the public/icons/crown-svgrepo-com-dark.svg to display centered on the general tile
	Update the lookout tower tiles to have a shiny distinctly colored surface and
	add the public/icons/tower-observation-svgrepo-com-dark.svg to display centered on it.
	Update the city tiles to have a shiny distinctly colored surface and
	add the public/icons/building-flag-svgrepo-com-dark.svg to display centered on it.
- #mobileGameStats should not display until there is at least 1 person joined to the game.
  (much like how the .players-list element already works).

## Tech Debt  
- Move all inline styles in all html files to css files.
	Organize them in the way that makes most sense WITHOUT altering effective styles at all.
- Identify the multiple moving parts of public/game.js (animation, ui, game).
  Break functionality out into modular pieces, breaking out similar functionality
	where possible into helpful utils/classes (DOM utility for manipulations, UI class for updating/initializing UI, etc).
	Refactor the game.js so that it is more maintainable (and likely is spread over multiple files/modules).
	Do this WITHOUT breaking anything.
- Examine the server code in src/
  Identify unit testable portions. Identify areas that could be safely refactored to become unit testable.
	Write unit tests for unit testable portions of src/
- Examine the fog of war game server in
	/Users/jsirrine/dev/user-workspace/prototypes/fog-of-war-server/src/game.ts and
	/Users/jsirrine/dev/user-workspace/prototypes/fog-of-war-server/server.ts
	Examine its client usage in public/game.js and src/bot.ts
	Write a spec named fog-of-war-spec (whatever file type/ext works best for you)
	that give a extremely detailed outline of how the game functions on a technical level.
	This isn't developer documentation or a user guide.
	This is a spec that will be used by engineers wanting to make bots that play the game,
	and rule officials and judges to be able to officiate regulated battles between bots.

## New features to implement  
- A display of the "Tick" or "Turn" that .fullDisplay .header
- Game sounds
	- on player tile move (plays only for the client's player tile moves)
		- one default sound
		- different sound for when player moves to a tile that is adjacent to a mountain
	- on general captured (plays for all game players when anyone's general is captured)
	- on game end
	- on game start
	- on turn 25 and multiples of turn 25 when armies are awarded to all owned territories.
- Options accordion in the #gameControls div
	- Game Settings (host only)
		(Game element density - 0 means none of that game element. Limit density to playable max density)
		- Mountains density
		- Cities density
		- Lookout tower density
		(Game Dimensions - must have minimum width, height to fill canvas, but allow for much larger maps)
		- Auto - optimal map size given the number of players in the game
		- width (with min/max restrictions)
		- height (with min/max restrictions)
	- Sound (on/off)
	- Stats (show/hide)
		- on mobile this would hide the #mobileGameStats until the game is over
		- on desktop the entire #gameControls div so the game canvas can take the full width of .mainRow until the game is over
