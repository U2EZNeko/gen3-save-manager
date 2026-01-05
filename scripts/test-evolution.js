const fs = require('fs');
const path = require('path');

// Test fetching Seviper's evolution chain
async function testEvolution() {
    try {
        const response = await fetch('http://localhost:3000/api/pokemon/species/336');
        const species = await response.json();
        console.log('Species data:', JSON.stringify(species, null, 2));
        
        if (species.evolution_chain && species.evolution_chain.url) {
            const chainId = parseInt(species.evolution_chain.url.split('/').slice(-2, -1)[0]);
            console.log('Chain ID:', chainId);
            
            const chainResponse = await fetch(`http://localhost:3000/api/pokemon/evolution-chain/${chainId}`);
            const chain = await chainResponse.json();
            console.log('\nEvolution chain:', JSON.stringify(chain, null, 2));
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

testEvolution();

