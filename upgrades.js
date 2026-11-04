function createUpgradePool(state) {
    return [
        { name: "Quick Reflexes", desc: "+15% Attack Speed", rarity: "Common", weight: 50, color: rgb(226, 232, 240), apply: () => state.attackCooldown = Math.max(0.05, state.attackCooldown * 0.85) },
        { name: "Sharpened Edge", desc: "+1 Attack Damage", rarity: "Common", weight: 50, color: rgb(226, 232, 240), apply: () => state.attackDamage += 1 },
        { name: "Running Shoes", desc: "+15% Move Speed", rarity: "Common", weight: 50, color: rgb(226, 232, 240), apply: () => state.playerSpeed += 35 },
        { name: "Adrenaline Shot", desc: "+35% Attack Speed & +20% Move Speed", rarity: "Rare", weight: 30, color: rgb(59, 130, 246), apply: () => { state.attackCooldown = Math.max(0.04, state.attackCooldown * 0.7); state.playerSpeed += 45; } },
        { name: "Heavy Payload", desc: "+2 Attack Damage & +30 Max HP", rarity: "Rare", weight: 30, color: rgb(59, 130, 246), apply: () => { state.attackDamage += 2; state.maxHp += 30; state.hp = Math.min(state.maxHp, state.hp + 30); } },
        { name: "Magnetism Ring", desc: "Massively increases XP pick-up range", rarity: "Rare", weight: 30, color: rgb(59, 130, 246), apply: () => state.magnetRadius += 180 },
        { name: "⚡ Dual Wielding", desc: "Fires an extra projectile per attack", rarity: "Legendary", weight: 8, color: rgb(245, 158, 11), apply: () => state.multiShot += 1 },
        { name: "👑 Royal Armor", desc: "+60 Max HP, heals fully & +25% Move Speed", rarity: "Legendary", weight: 8, color: rgb(245, 158, 11), apply: () => { state.maxHp += 60; state.hp = state.maxHp; state.playerSpeed += 50; } },
        { name: "🔥 Overclock Core", desc: "Cuts attack cooldown in half!", rarity: "Legendary", weight: 6, color: rgb(245, 158, 11), apply: () => state.attackCooldown *= 0.5 }
    ];
}

function createMythicPool(state, player) {
    const mythics = [
        "🌌 Void Singularity", "💀 Reaper's Harvest", "☄️ Meteor Swarm", "🛡️ Aegis Shield", "⏳ Time Dilation",
        "⚡ Hyper-Charge Battery", "☀️ Solar Nova", "🌀 Event Horizon", "🩸 Blood Sovereign", "☣️ Plague Spore Aura",
        "🧊 Zero Kelvin Dilation", "👑 Overlord's Presence", "💥 Supernova Overdrive", "⚡ Chain Lightning Mastery",
        "🧲 Quantum Gravity Well", "🛡️ Titanium Sentinel", "🗡️ Blade Storm Halo", "🎯 Executioner's Mark",
        "🔥 Hellfire Phoenix", "💫 Celestial Alignment", "☣️ Acid Tsunami", "⌛ Chrono Echo", "🌟 Supernova Core"
    ];
    return mythics.map(name => ({
        name: name,
        desc: `Mythic Trait: Stacks endlessly to amplify power and unleash devastating combat effects.`,
        rarity: "Mythic",
        weight: 2,
        color: rgb(168, 85, 247),
        apply: () => {
            state.attackDamage += 2;
            if (name === "🛡️ Aegis Shield") { state.maxHp += 50; state.hp += 50; }
            if (name === "⚡ Hyper-Charge Battery" || name === "⌛ Chrono Echo") { state.multiShot += 1; }
            playSound('mythic');
        }
    }));
}

function createUniqueAbilitiesPool(state) {
    return [
        { name: "✨ Vampiric Siphon", desc: "Unique: Heals 1 HP every 5 enemy kills.", rarity: "Unique Ability", weight: 4, color: rgb(236, 72, 153), apply: () => { if (!state.activeAbilities.includes("Vampiric Siphon")) state.activeAbilities.push("Vampiric Siphon"); } },
        { name: "⚡ Static Discharge", desc: "Unique: Automatically zaps a random nearby enemy every 2 seconds.", rarity: "Unique Ability", weight: 4, color: rgb(236, 72, 153), apply: () => { if (!state.activeAbilities.includes("Static Discharge")) state.activeAbilities.push("Static Discharge"); } },
        { name: "🛡️ Thorn Armor", desc: "Unique: Damaging contact pushes enemies away with forceful impact.", rarity: "Unique Ability", weight: 4, color: rgb(236, 72, 153), apply: () => { if (!state.activeAbilities.includes("Thorn Armor")) state.activeAbilities.push("Thorn Armor"); } }
    ];
}