# Twilight Imperium 4th ed. battle calculator #

This is a calculator of battle outcomes probabilities for Twilight Imperium board game. You can play with it at [alphamou.se/ti4calc](http://alphamou.se/ti4calc).  
It's written purely in client-side javascript so can be easily copied locally and run from the file system.  
Licensed under [Creative Commons Attribution](http://creativecommons.org/licenses/by/4.0/) license.  
I have no further plans of improving it. If you find a bug or consider some feature needed, let me know (ivan.bachtin@gmail.com) or create an [issue](../../issues). Or feel free to implement anything yourself, I'll happily accept pull requests. Or you can even steal it and improve it silently. Whatever =)
Also, I haven't played the game myself, so if you notice something suspicious, it might very likely be wrong, so don't hesitate to notify me.

## Developing calculator ##
### Unit tests ###
Although you can change calculator logic and manually test it in the browser it would be more reliable to verify changes with automatic unit tests.  
For that you'll need

1. [node.js](https://nodejs.org/). I used version 6.11.0. I suppose newer versions should be fine as well.
2. After installing node, run the following command from the command line  
   `npm install nodeunit -g`  
   That will install [nodeunit](https://github.com/caolan/nodeunit), a module for unit testing.

Now you can go to the project folder (one where _calculator.js_ is located) in the console and execute `nodeunit test`. If all is fine that will run unit tests and report errors if any. Tests themselves are located in _test/test-calculator.js_. Most of the tests compare calculated probabilities with averaged results of tens of thousands simulated battle runs. Individual tests could be run as `nodeunit -t TEST_NAME`.

### Debugging ###
There two good ways do debug the code.

1. Browser developer tools while running the application in the browser. Here one can debug UI logic and the calculator. If you haven't heard about developer tools just google [chrome developer tools](https://www.google.com/search?q=chrome+developer+tools) or [firefox developer tools](https://www.google.com/search?q=firefox+developer+tools) or "[your browser] developer tools"
2. [node-inspector](https://github.com/node-inspector/node-inspector) module. Here you can debug the calculator and the imitator (which calculates probabilities by simulating thousands of battles). You can install node-inspector with `npm install -g node-inspector`. I use _demo.js_ file to try different experiments, so to debug, execute `node-debug demo.js`.

## Algorithm description ##

This calculator algorithm is mostly the same that I used in the [calculator for the third edition of Twilight Imperium](https://bitbucket.org/IvanBakhtin/ti3calculator).

### The gist ###
The calculator computes probabilities using a probability propagation algorithm I describe below. It's much faster than running many iterations of battles and averaging results. But I've implemented statistical algorithm as well and used it to test probability propagation algorithm.  
Here goes high level description of the algorithm.  
It's based on the assumption that preferred units dying order is defined before the battle and doesn't change during its course. This may not be the case in general. I can conceive that initially you might try to save Carrier with Ground Forces to make an invasion, but later seeing that the battle will be lost anyway abandon it and try to prolong life of Dreadnoughts to inflict maximum damage. In practice though I don't see how such concerns can be reasonably taken care of in a calculator of any type.  
I take both fleets (I'll call Ground Forces in an Invasion Combat a fleet as well) and arrange units in them in what I consider a reasonable order of importance which is Flagship, War Sun, Dreadnought, Cruiser, Carrier, Destroyer, Fighter. Then (here goes the key point) possible states of the combat can be represented by a table in which columns and rows correspond to units of one and another army respectively. For example, let there be an attacker army consisting of two Cruisers and defending army of a Carrier and two Fighters.

|           |        | Carrier | Fighter | Fighter |
|:---------:|:------:|:-------:|:-------:|:-------:|
|           |   =    |         |         |         |
|**Cruiser**|        |         |         |         |
|**Cruiser**|        |         |   *     |         |

The cell marked by a __\*__ then represents a state when both attacker's Cruisers are still alive and the defender has lost one of the Fighters. __=__ cell will denote a state where both armies are dead and the battle has ended in a draw.  
Now we can put **probabilities** in the cells!  

|           |        | Carrier | Fighter | Fighter |
|:---------:|:------:|:-------:|:-------:|:-------:|
|           |   0    |   0     |   0     |   0     |
|**Cruiser**|   0    |   0     |   0     |   0     |
|**Cruiser**|   0    |   0     |   0     |   1     |

This table represents game state at the start of the battle, when both fleets are untouched.  
During the first round of the battle two Cruisers can inflict 0, 1, 2 hits with probabilities 0.36, 0.48, 0.16 respectively. Carrier and two Fighters can inflict 0, 1, 2, 3 hits with probabilities 0.512, 0.384, 0.096, 0.008. So after the first round the states probabilities will be  

|           |        | Carrier | Fighter | Fighter |
|:---------:|:------:|:-------:|:-------:|:-------:|
|           |   0    | 0.01664 | 0.04992 | 0.03744 |
|**Cruiser**|   0    | 0.06144 | 0.18432 | 0.13824 |
|**Cruiser**|   0    | 0.08192 | 0.24576 | 0.18432 |

Probability mass of 1 from bottom right corner has been redistributed all across the table. On the second round we can apply such probability redistributions for all non-zero cells to get states probabilities after two rounds. You may notice that probabilities from first row and first column are not redistributed, because these cells represent opposing fleet being destroyed. Also, from each cell probability is redistributed to the above/left cells.  
After enough rounds of propagation practically all probability mass will trickle down to the first row and column. Number in the upper left cell will give us probability of the battle ending in a draw. All the other cells in first row/column contain probabilities of corresponding fleets subsets being left after the battle ends. So this is a gist of the algorithm. Below are some details and complications.  

### Optimization ###
We can do better than this iterative probability propagation. We do not need to know states probabilities after each specific number of rounds. We are only interested in final probabilities after hypothetical infinite number of rounds. So we can rearrange order of redistributions. We can first totally redistribute bottom right cell, then all the rest of the last column, and continue to clear the inner table completely cell by cell. Why rearrange? We can make redistribution from one cell in one step, without iterating. In infinitely many redistributions from a single cell we are going to move all its probability mass to other cell proportionally. So if we divide all the numbers except for lower right by 1-0.18432 = 0.81568 we'll get result of such complete redistribution.  

|           |        | Carrier | Fighter | Fighter |
|:---------:|:------:|:-------:|:-------:|:-------:|
|           |   0    | 0.02040 | 0.06120 | 0.04590 |
|**Cruiser**|   0    | 0.07532 | 0.22597 | 0.16948 |
|**Cruiser**|   0    | 0.10043 | 0.30129 |  0      |

Now we can just redistribute mass from all the cells one by one in 5 more operations.  

### Complications ###

#### Attack modifiers ####
Some units can have technology or race modifiers to attack rolls. That's handled easily by taking these modifiers into account when computing inflicted hits probabilities.

#### Damageable ships ####
Flagships, War Suns, Dreadnoughts, and upgraded Sol Carriers are capable of taking one hit without dying (Non-Euclidean Shielding of Letnev allows to absorb even two hits). For these ships I add what I call "damage ghosts" to the fleet. These are fake units that don't fire and exist to denote damage hit applied to a damageable unit. I place them in the end of the fleet ordering under an assumption that player will take damage to these ships before killing all the rest (this assumption might not be always reasonable given the existence of Direct Hit Action Card; there is an option in the calculator to change the ordering). So for two Dreadnoughts and a Cruiser expanded fleet ordering will be Dreadnought, Dreadnought, Cruiser, dreadnought, dreadnought, where lower case "dreadnought" is such damage ghost and upper case "Dreadnought" will be killed with just one hit.

#### PDS fire and other effects ####
To take PDS fire into account we can just apply one round of probability redistribution caused by PDS fire. Then the actual battle is computed starting with this already modified probability table. Some Action Cards, Bombardment and other effects are handled exactly like PDS fire by doing one round of propagation. Anti-Fighter Barrage is considerably more complicated, will describe it below.

#### Anti-Fighter Barrage, Graviton Laser and Assault Cannon ####
Well, here my cherished assumption of ordered units dying went down the tubes. I'd say that handling these effects is as complicated as all the rest of the calculator. They are handles similarly, so I'll describe the Barrage only.  
The problem arises when fleet of damageable ships and Fighters is affected by opponent's barrage. On the one hand I assume that damageable ships should take hits first. On the other, barrage only targets Fighters. So I cannot propagate probability in the table in any consistent way. To workaround this I split problem into several subproblems, solve them and combine results in the end. Let's consider an example, Dreadnought and Fighter vs Destroyer. Initially we have  

|             |        | Dreadnought | Fighter | dreadnought |
|:-----------:|:------:|:-----------:|:-------:|:-----------:|
|             |   0    |   0         |   0     |   0         |
|**Destroyer**|   0    |   0         |   0     |   1         |

Destroyer can either kill this Fighter with probability 0.36 or miss it with probability 0.64. We can split our problem into  

|             |        | Dreadnought | Fighter | dreadnought |
|:-----------:|:------:|:-----------:|:-------:|:-----------:|
|             |   0    |   0         |   0     |   0         |
|**Destroyer**|   0    |   0         |   0     |   0.64      |

and  

|             |        | Dreadnought | dreadnought |
|:-----------:|:------:|:-----------:|:-----------:|
|             |   0    |   0         |   0         |
|**Destroyer**|   0    |   0         |   0.36      |

Notice how probabilities in the resulting tables sum to 1. In the worst case, we get up to `Af + Df + Af*Df` subproblems, where Af and Df are numbers of attacking and defending Fighters. These subproblems are solved separately and resulting probabilities are summed across all of them. I thought of an optimisation where we can solve all subproblems partially, combine intermediate results and continue propagation till the end, but thought that it will give at best ~2x speed improvement, which I was lazy to pursue as barrage code was already too complicated. To see why it was complicated consider taking into account PDS fire, so that before computing barrage effects table is already full of non-zero probabilities.

#### Duranium Armor ####
Duranium Armor is a technology that allows to repair one damaged unit at the end of each combat round. As with Barrage, this breaks assumptions that allowed fast probability calculation. First, when previously probability mass was moving only up and left in the table, now it can move back down and right. Or in another terms previously each cell's probability depended only on cells to the right and bottom of it, now each cell depends on the entire table, which means I cannot do one pass through the table and be done. Another complication (though no as severe) is that where previously fleet remains during battle were always a subset from the beginning of the initial fleet composition (units at the tail of the fleet were eliminated), now some ships in the middle of the fleet might be killed while some damage ghost are restored in the tail.

As much as I tried, I failed to imagine any good algorithm to compute probabilities when Duranium Armor is involved. So I had no choice but to do many battle simulations and average the results.

## Credits ##

* Ling Weak, Edward Nickson, and L0ft3r – for various improvements to the calculator for the third edition of the game. This calculator is heavily based on that one.
* Joakim Andersson (j.ason a⁣t live.se) – invaluable contribution to finding subtle miscalculations in Duranium Armor, Letnev and Jol-Nar flagships handling. Other great suggestions.
* Alex Grant – mobile-friendly UI version.
* Dan Johnson – Naalu fleet cost calculation fix.
