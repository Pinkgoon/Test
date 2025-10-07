export function updateSpawn(state, dt){
state.spawnTimer -= dt; if(state.spawnTimer<=0){
state.spawnTimer = (0.9 - Math.min(0.6, state.timeSurvived*0.01)) + Math.random()*0.5;
return true; // should spawn
}
return false;
}