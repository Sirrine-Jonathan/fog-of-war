# TODO

## Defects to fix  
- ✅ **COMPLETED**: Enemy generals spawn to close to each other. Update general spawn logic to
	balance space between all other generals and edges of the map.
- ✅ **COMPLETED**: Update cities to spawn spread out from other cities. They can be up against
	walls, mountains, towers, and general tiles.
- ✅ **COMPLETED**: Use public/icons/triangle-svgrepo-com-dark.svg for the triangle toggle in .accordion-header
- ✅ **COMPLETED**: Cities and Lookout towers should keep their shiny appearance when taken over and
	remain the same color they were, rather than taking on the players color.
- ✅ **COMPLETED**: Intent system that uses path finding to move armies from active square to a target square
	(the non adjacent to the active square that was clicked/touched)
  needs to be updated to move armies all the way to the target square and the target square should become
	the active square if the armies arrived safely.
- ✅ **COMPLETED**: The active square's border is currently gold. It should be gray if the active square has only 1 army.
- ✅ **COMPLETED**: The text in #mobileStatsTable is white, but the highlight color used on the player's row is too light for
  white text. Let's highlight the players row with a darker color that can use white text.
- ✅ **COMPLETED**: Remove the icon from the general tile
- ✅ **COMPLETED**: When a tower or city is attacked, it will display the defense it was lowered to at the time of the attack.
  The number shows for 1.5 seconds before fading out. Currently the number displayed is always zero.
	If a user attacks with 5 armies (6 on the tile minus one to leave behind) and the tower starts with a 
	defense of 25, then the tower should show 20 for a short time before fading out, attacks that happen
	while the number is being shown do not affect the display.

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
- Correctly attribute icons in public/icons according to https://www.svgrepo.com/page/licensing/#CC%20Attribution

## New features to implement  
- ✅ **COMPLETED**: A display of the "Tick" or "Turn" that .fullDisplay .header
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
