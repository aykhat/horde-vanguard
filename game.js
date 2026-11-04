kaplay({
    width: 1280,
    height: 720,
    letterbox: true,
    background: [15, 23, 42],
});

// Load the custom uploaded Spud enemy sprite from project files
loadSprite("spudling", "Enemy.png");

scene("main", () => {
    const gameState = {
        isPaused: false,
        godMode: false,
        maxHp: 100,
        hp: 100,
        xp: 0,
        level: 1,
        xpToNextLevel: 8,
        kills: 0,
        playerSpeed: 240,
        magnetRadius: 150,
        attackCooldown: 0.5,
        attackTimer: 0,
        projectileSpeed: 650,
        attackDamage: 1,
        multiShot: 1,
        activeAbilities: [],
        activeMythics: [],
        mythicStacks: {}
    };

    const uiBox = add([fixed(), z(100)]);

    const hpText = uiBox.add([
        text(`HP: ${gameState.hp}/${gameState.maxHp}`, { size: 22 }),
        pos(30, 25),
        color(239, 68, 68),
    ]);

    const levelText = uiBox.add([
        text(`LVL: ${gameState.level} (XP: ${gameState.xp}/${gameState.xpToNextLevel})`, { size: 22 }),
        pos(30, 55),
        color(59, 130, 246),
    ]);

    const killText = uiBox.add([
        text(`KILLS: ${gameState.kills}`, { size: 22 }),
        pos(30, 85),
        color(251, 191, 36),
    ]);

    const traitsContainer = uiBox.add([
        pos(30, 115),
    ]);

    const tooltipBox = uiBox.add([
        rect(240, 60, { radius: 6 }),
        color(15, 23, 42),
        outline(2, rgb(168, 85, 247)),
        pos(30, 155),
        opacity(0),
        z(150),
    ]);

    const tooltipText = tooltipBox.add([
        text("", { size: 12, width: 220 }),
        pos(10, 10),
        color(248, 250, 252),
    ]);

    function updateTraitsDisplay() {
        traitsContainer.get("trait_badge").forEach(b => destroy(b));

        let allTraits = [
            ...gameState.activeAbilities.map(a => ({ name: a, type: "Unique", color: rgb(236, 72, 153) })),
            ...gameState.activeMythics.map(m => ({ name: m, type: "Mythic", color: rgb(168, 85, 247), stacks: gameState.mythicStacks[m] || 1 }))
        ];

        allTraits.forEach((trait, idx) => {
            let badgeText = trait.name.split(" ")[0];
            if (trait.stacks && trait.stacks > 1) badgeText += `x${trait.stacks}`;

            const badge = traitsContainer.add([
                rect(36, 36, { radius: 6 }),
                color(30, 41, 59),
                outline(2, trait.color),
                pos(idx * 42, 0),
                area(),
                anchor("topleft"),
                "trait_badge",
            ]);

            badge.add([
                text(badgeText, { size: 14 }),
                pos(18, 18),
                anchor("center"),
                color(255, 255, 255),
            ]);

            badge.onHover(() => {
                tooltipBox.opacity = 0.95;
                let desc = `${trait.name}\nType: ${trait.type}`;
                if (trait.stacks) desc += ` | Stacks: ${trait.stacks}`;
                tooltipText.text = desc;
                tooltipBox.pos.x = 30 + (idx * 42);
            });

            badge.onHoverEnd(() => {
                tooltipBox.opacity = 0;
                tooltipText.text = "";
            });
        });
    }

    for (let x = -5000; x < 5000; x += 300) {
        for (let y = -5000; y < 5000; y += 300) {
            add([
                rect(280, 280, { radius: 8 }),
                pos(x, y),
                color(22, 32, 52),
                z(-10),
            ]);
        }
    }

    const player = add([
        circle(20),
        color(59, 130, 246),
        outline(3, rgb(147, 197, 253)),
        pos(0, 0),
        area(),
        body(),
        anchor("center"),
        "player",
    ]);

    const upgradePool = createUpgradePool(gameState);
    const mythicPool = createMythicPool(gameState, player);
    const uniqueAbilitiesPool = createUniqueAbilitiesPool(gameState);

    player.onUpdate(() => {
        camPos(player.pos);
        if (player.pos.x < -4800) player.pos.x = -4800;
        if (player.pos.x > 4800) player.pos.x = 4800;
        if (player.pos.y < -4800) player.pos.y = -4800;
        if (player.pos.y > 4800) player.pos.y = 4800;

        if (gameState.activeMythics.includes("Void Singularity")) {
            get("gem").forEach(g => {
                if (g.pos.dist(player.pos) < 600) {
                    g.move(player.pos.sub(g.pos).unit().scale(350));
                }
            });
        }
    });

    onUpdate(() => {
        if (gameState.isPaused) return;

        let moveDir = vec2(0, 0);
        if (isKeyDown("left") || isKeyDown("a")) moveDir.x -= 1;
        if (isKeyDown("right") || isKeyDown("d")) moveDir.x += 1;
        if (isKeyDown("up") || isKeyDown("w")) moveDir.y -= 1;
        if (isKeyDown("down") || isKeyDown("s")) moveDir.y += 1;

        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let gp of gamepads) {
            if (gp) {
                let stickX = gp.axes[0];
                let stickY = gp.axes[1];
                let deadzone = 0.15;
                if (Math.abs(stickX) > deadzone || Math.abs(stickY) > deadzone) {
                    moveDir.x += stickX;
                    moveDir.y += stickY;
                }
                if (gp.buttons[12] && gp.buttons[12].pressed) moveDir.y -= 1;
                if (gp.buttons[13] && gp.buttons[13].pressed) moveDir.y += 1;
                if (gp.buttons[14] && gp.buttons[14].pressed) moveDir.x -= 1;
                if (gp.buttons[15] && gp.buttons[15].pressed) moveDir.x += 1;
                break;
            }
        }

        if (moveDir.len() > 0) {
            moveDir = moveDir.unit();
            player.move(moveDir.scale(gameState.playerSpeed));
        }
    });

    let consoleOpen = false;
    const cheatOverlay = document.createElement('div');
    cheatOverlay.style.cssText = 'display:none; position:fixed; top:20px; left:50%; transform:translateX(-50%); width:500px; background:rgba(15, 23, 42, 0.95); border:2px solid #a855f7; border-radius:8px; padding:15px; z-index:99999; font-family:sans-serif; box-shadow:0 10px 25px rgba(0,0,0,0.7);';
    cheatOverlay.innerHTML = `
        <div style="color:#a855f7; font-weight:bold; margin-bottom:8px; font-size:16px;">🛠️ DEV CHEAT CONSOLE</div>
        <div style="color:#94a3b8; font-size:12px; margin-bottom:10px;">Commands: <b style="color:#f8fafc">godmode</b>, <b style="color:#f8fafc">addxp [num]</b>, <b style="color:#f8fafc">addhp [num]</b>, <b style="color:#f8fafc">speed [num]</b>, <b style="color:#f8fafc">killall</b>, <b style="color:#f8fafc">levelup</b></div>
        <input id="cheatInput" type="text" placeholder="Type command here..." style="width:100%; padding:8px; background:#1e293b; border:none; color:white; border-radius:4px; box-sizing:border-box; outline:none;" />
    `;
    document.body.appendChild(cheatOverlay);
    const cheatInput = document.getElementById('cheatInput');

    onKeyPress("q", () => {
        consoleOpen = !consoleOpen;
        gameState.isPaused = consoleOpen;
        cheatOverlay.style.display = consoleOpen ? 'block' : 'none';
        if (consoleOpen) {
            setTimeout(() => cheatInput.focus(), 50);
        } else {
            cheatInput.blur();
        }
    });

    cheatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            let cmd = cheatInput.value.trim().toLowerCase();
            let parts = cmd.split(' ');
            let action = parts[0];
            let val = parseInt(parts[1]) || 0;

            if (action === 'godmode') {
                gameState.godMode = !gameState.godMode;
                gameState.hp = 99999;
                gameState.maxHp = 99999;
                hpText.text = `HP: GODMODE`;
            } else if (action === 'addxp') {
                gameState.xp += (val > 0 ? val : 10);
                if (gameState.xp >= gameState.xpToNextLevel) {
                    gameState.level++;
                    gameState.xp = 0;
                    gameState.xpToNextLevel = Math.floor(gameState.xpToNextLevel * 1.6);
                    consoleOpen = false;
                    cheatOverlay.style.display = 'none';
                    showUpgradeMenu();
                }
                levelText.text = `LVL: ${gameState.level} (XP: ${gameState.xp}/${gameState.xpToNextLevel})`;
            } else if (action === 'addhp') {
                gameState.maxHp += (val > 0 ? val : 50);
                gameState.hp = gameState.maxHp;
                hpText.text = `HP: ${Math.ceil(gameState.hp)}/${gameState.maxHp}`;
            } else if (action === 'speed') {
                gameState.playerSpeed = (val > 0 ? val : 300);
            } else if (action === 'killall') {
                get("enemy").forEach(e => destroy(e));
            } else if (action === 'levelup') {
                gameState.level++;
                gameState.xp = 0;
                gameState.xpToNextLevel = Math.floor(gameState.xpToNextLevel * 1.6);
                consoleOpen = false;
                cheatOverlay.style.display = 'none';
                showUpgradeMenu();
            }
            cheatInput.value = '';
        }
    });

    let staticTimer = 0;
    let meteorTimer = 0;
    let solarTimer = 0;
    let celestialTimer = 0;
    let acidTrailTimer = 0;
    let bladeAngle = 0;
    let overlordAngle = 0;
    let invulnerableTimer = 0;
    let emergencyCooldown = 0;

    onUpdate(() => {
        if (gameState.isPaused) return;

        if (invulnerableTimer > 0) invulnerableTimer -= dt();
        if (emergencyCooldown > 0) emergencyCooldown -= dt();

        if (gameState.activeMythics.includes("💫 Celestial Alignment")) {
            celestialTimer += dt();
            let stacks = gameState.mythicStacks["💫 Celestial Alignment"] || 1;
            if (celestialTimer >= 10.0) {
                gameState.attackDamage += (2 * stacks);
                celestialTimer = 0;
            }
        }

        if (gameState.activeMythics.includes("☣️ Acid Tsunami")) {
            acidTrailTimer += dt();
            let stacks = gameState.mythicStacks["☣️ Acid Tsunami"] || 1;
            if (acidTrailTimer >= 0.15) {
                const trailPos = player.pos;
                const acidPuddle = add([
                    circle(15 + stacks * 5),
                    color(132, 204, 22),
                    opacity(0.4),
                    pos(trailPos),
                    anchor("center"),
                    z(5)
                ]);
                wait(2.0 + stacks, () => destroy(acidPuddle));

                get("enemy").forEach(e => {
                    if (e.pos.dist(trailPos) < 20 + stacks * 5) {
                        e.hp -= (0.5 * stacks);
                        if (e.hp <= 0) { destroy(e); gameState.kills++; killText.text = `KILLS: ${gameState.kills}`; }
                    }
                });
                acidTrailTimer = 0;
            }
        }

        if (gameState.activeMythics.includes("🗡️ Blade Storm Halo")) {
            let stacks = gameState.mythicStacks["🗡️ Blade Storm Halo"] || 1;
            let bladeCount = 2 + stacks * 2;
            bladeAngle += dt() * (2 + stacks * 0.5);

            for (let i = 0; i < bladeCount; i++) {
                let offset = (Math.PI * 2 / bladeCount) * i + bladeAngle;
                let bladePos = player.pos.add(vec2(Math.cos(offset) * (90 + stacks * 10), Math.sin(offset) * (90 + stacks * 10)));
                
                get("enemy").forEach(e => {
                    if (e.pos.dist(bladePos) < 25) {
                        e.hp -= (0.3 * gameState.attackDamage * stacks);
                        if (e.hp <= 0) { destroy(e); gameState.kills++; killText.text = `KILLS: ${gameState.kills}`; }
                    }
                });
            }
        }

        if (gameState.activeMythics.includes("🧲 Quantum Gravity Well")) {
            let stacks = gameState.mythicStacks["🧲 Quantum Gravity Well"] || 1;
            get("gem").forEach(g => {
                g.move(player.pos.sub(g.pos).unit().scale(250 + stacks * 150));
            });
        }

        if (gameState.activeMythics.includes("☀️ Solar Nova")) {
            solarTimer += dt();
            let stacks = gameState.mythicStacks["☀️ Solar Nova"] || 1;
            let cooldown = Math.max(0.8, 3.0 - (stacks * 0.4));
            if (solarTimer >= cooldown) {
                playSound('hit');
                const nova = add([
                    circle(120 + stacks * 25),
                    color(245, 158, 11),
                    opacity(0.5),
                    pos(player.pos),
                    anchor("center"),
                    z(40)
                ]);
                wait(0.2, () => destroy(nova));

                get("enemy").forEach(e => {
                    if (e.pos.dist(player.pos) < 120 + stacks * 25) {
                        e.hp -= (gameState.attackDamage * (2 + stacks));
                        if (e.hp <= 0) { destroy(e); gameState.kills++; }
                    }
                });
                killText.text = `KILLS: ${gameState.kills}`;
                solarTimer = 0;
            }
        }

        if (gameState.activeMythics.includes("🌀 Event Horizon")) {
            let stacks = gameState.mythicStacks["🌀 Event Horizon"] || 1;
            get("enemy").forEach(e => {
                if (e.pos.dist(player.pos) < 100 + stacks * 20) {
                    e.hp -= (0.1 * stacks);
                    if (e.hp <= 0) { destroy(e); gameState.kills++; killText.text = `KILLS: ${gameState.kills}`; }
                }
            });
        }

        if (gameState.activeMythics.includes("👑 Overlord's Presence")) {
            let stacks = gameState.mythicStacks["👑 Overlord's Presence"] || 1;
            let droneCount = stacks * 2;
            overlordAngle += dt() * 3;

            for (let i = 0; i < droneCount; i++) {
                let offset = (Math.PI * 2 / droneCount) * i + overlordAngle;
                let dronePos = player.pos.add(vec2(Math.cos(offset) * 80, Math.sin(offset) * 80));
                
                get("enemy").forEach(e => {
                    if (e.pos.dist(dronePos) < 40) {
                        e.hp -= (0.2 * gameState.attackDamage);
                        if (e.hp <= 0) { destroy(e); gameState.kills++; killText.text = `KILLS: ${gameState.kills}`; }
                    }
                });
            }
        }

        if (gameState.activeAbilities.includes("Static Discharge")) {
            staticTimer += dt();
            if (staticTimer >= 2.0) {
                const enemies = get("enemy");
                if (enemies.length > 0) {
                    const target = enemies[Math.floor(Math.random() * enemies.length)];
                    if (target && target.pos.dist(player.pos) < 400) {
                        target.hp -= (gameState.attackDamage * 2);
                        playSound('hit');
                        const zap = add([
                            rect(4, player.pos.dist(target.pos)),
                            color(59, 130, 246),
                            pos(player.pos),
                            anchor("top"),
                            rotate(target.pos.sub(player.pos).angle()),
                            z(50)
                        ]);
                        wait(0.1, () => destroy(zap));

                        if (target.hp <= 0) {
                            destroy(target);
                            gameState.kills++;
                            killText.text = `KILLS: ${gameState.kills}`;
                        }
                    }
                }
                staticTimer = 0;
            }
        }

        if (gameState.activeMythics.includes("☄️ Meteor Swarm")) {
            meteorTimer += dt();
            if (meteorTimer >= 1.5) {
                const enemies = get("enemy");
                if (enemies.length > 0) {
                    const target = enemies[Math.floor(Math.random() * enemies.length)];
                    if (target && target.pos.dist(player.pos) < 600) {
                        const explosionPos = target.pos;
                        playSound('hit');
                        const fire = add([
                            circle(24),
                            color(249, 115, 22),
                            outline(3, rgb(239, 68, 68)),
                            pos(explosionPos),
                            anchor("center"),
                            area(),
                            z(60)
                        ]);
                        wait(0.2, () => destroy(fire));

                        get("enemy").forEach(e => {
                            if (e.pos.dist(explosionPos) < 70) {
                                e.hp -= (gameState.attackDamage * 3);
                                if (e.hp <= 0) {
                                    destroy(e);
                                    gameState.kills++;
                                    killText.text = `KILLS: ${gameState.kills}`;
                                }
                            }
                        });
                    }
                }
                meteorTimer = 0;
            }
        }
    });

    let spawnTimer = 0;
    onUpdate(() => {
        if (gameState.isPaused) return;
        spawnTimer += dt();
        let currentSpawnInterval = Math.max(0.2, 0.9 - (gameState.level * 0.06));

        if (spawnTimer >= currentSpawnInterval) {
            const angle = rand(0, Math.PI * 2);
            const distance = rand(800, 1100);
            const spawnPos = player.pos.add(vec2(Math.cos(angle) * distance, Math.sin(angle) * distance));

            if (spawnPos.x >= -4900 && spawnPos.x <= 4900 && spawnPos.y >= -4900 && spawnPos.y <= 4900) {
                add([
                    sprite("spudling"),
                    pos(spawnPos),
                    area(),
                    body(),
                    anchor("center"),
                    scale(1.0),
                    "enemy",
                    { 
                        hp: 2 + Math.floor(gameState.level * 0.7), 
                        speed: rand(110, 160 + (gameState.level * 3)),
                        isRanged: true,
                        attackTimer: rand(0, 2)
                    }
                ]);
            }
            spawnTimer = 0;
        }
    });

    onUpdate("enemy", (enemy) => {
        if (gameState.isPaused) return;
        if (enemy.pos.dist(player.pos) > 1800) {
            destroy(enemy);
            return;
        }

        const dir = player.pos.sub(enemy.pos).unit();
        let speedMultiplier = gameState.activeMythics.includes("Time Dilation") ? 0.7 : 1.0;

        // Enemy rushes directly toward player for physical contact
        enemy.move(dir.scale(enemy.speed * speedMultiplier));
    });

    onUpdate("gem", (gem) => {
        if (gameState.isPaused) return;
        if (gem.pos.dist(player.pos) < gameState.magnetRadius) {
            const gemDir = player.pos.sub(gem.pos).unit();
            gem.move(gemDir.scale(400));
        }
    });

    player.onCollide("gem", (gem) => {
        if (gameState.isPaused) return;
        destroy(gem);
        playSound('gem');
        gameState.xp += (gem.value || 1);

        if (gameState.xp >= gameState.xpToNextLevel) {
            gameState.level++;
            gameState.xp -= gameState.xpToNextLevel;
            gameState.xpToNextLevel = Math.floor(gameState.xpToNextLevel * 1.5);
            showUpgradeMenu();
        }

        levelText.text = `LVL: ${gameState.level} (XP: ${gameState.xp}/${gameState.xpToNextLevel})`;
    });

    function showUpgradeMenu() {
        gameState.isPaused = true;
        playSound('levelup');

        const menuOverlay = add([
            rect(1280, 720),
            color(15, 23, 42),
            opacity(0.92),
            fixed(),
            z(200),
        ]);

        menuOverlay.add([
            text(`LEVEL UP! (LEVEL ${gameState.level})`, { size: 42 }),
            pos(center().x, 80),
            anchor("center"),
            color(251, 191, 36),
        ]);

        const fullPool = [...upgradePool, ...uniqueAbilitiesPool, ...mythicPool];
        const cardOptions = [];

        for (let i = 0; i < 3; i++) {
            const totalWeight = fullPool.reduce((acc, card) => acc + card.weight, 0);
            let randomVal = Math.random() * totalWeight;
            let selected = fullPool[0];

            for (let card of fullPool) {
                if (randomVal < card.weight) {
                    selected = card;
                    break;
                }
                randomVal -= card.weight;
            }
            cardOptions.push(selected);
        }

        cardOptions.forEach((option, idx) => {
            const cardX = center().x + (idx - 1) * 360;
            const cardY = center().y + 30;

            let stackCount = gameState.mythicStacks[option.name] || 0;
            let displayTitle = option.name;
            if (option.rarity === "Mythic" && stackCount > 0) {
                displayTitle += ` (x${stackCount + 1})`;
            }

            const card = menuOverlay.add([
                rect(320, 380, { radius: 12 }),
                pos(cardX, cardY),
                anchor("center"),
                color(30, 41, 59),
                outline(4, option.color),
                area(),
                "card",
            ]);

            card.add([
                text(option.rarity.toUpperCase(), { size: 16 }),
                pos(0, -140),
                anchor("center"),
                color(option.color),
            ]);

            card.add([
                text(displayTitle, { size: 20, width: 280, align: "center" }),
                pos(0, -90),
                anchor("center"),
                color(255, 255, 255),
            ]);

            card.add([
                text(option.desc, { size: 16, width: 260, align: "center" }),
                pos(0, 10),
                anchor("center"),
                color(203, 213, 225),
            ]);

            const chooseBtn = card.add([
                rect(200, 48, { radius: 8 }),
                pos(0, 120),
                anchor("center"),
                color(option.color),
                area(),
            ]);

            chooseBtn.add([
                text("SELECT", { size: 18 }),
                pos(0, 0),
                anchor("center"),
                color(15, 23, 42),
            ]);

            chooseBtn.onClick(() => {
                option.apply();

                if (option.rarity === "Mythic") {
                    if (!gameState.activeMythics.includes(option.name)) {
                        gameState.activeMythics.push(option.name);
                    }
                    gameState.mythicStacks[option.name] = (gameState.mythicStacks[option.name] || 0) + 1;
                }

                if (option.rarity === "Unique Ability") {
                    if (!gameState.activeAbilities.includes(option.name)) {
                        gameState.activeAbilities.push(option.name);
                    }
                }

                updateTraitsDisplay();
                destroy(menuOverlay);
                gameState.isPaused = false;
            });
        });
    }

    onUpdate(() => {
        if (gameState.isPaused) return;

        gameState.attackTimer += dt();
        if (gameState.attackTimer >= gameState.attackCooldown) {
            const enemies = get("enemy");
            if (enemies.length > 0) {
                let closestEnemy = enemies[0];
                let closestDist = player.pos.dist(closestEnemy.pos);

                for (let i = 1; i < enemies.length; i++) {
                    const dist = player.pos.dist(enemies[i].pos);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestEnemy = enemies[i];
                    }
                }

                if (closestDist <= 750) {
                    const fireBullet = () => {
                        const baseDir = closestEnemy.pos.sub(player.pos).unit();
                        playSound('shoot');

                        for (let i = 0; i < gameState.multiShot; i++) {
                            const spreadAngle = (i - (gameState.multiShot - 1) / 2) * 0.15;
                            const bulletDir = vec2(
                                baseDir.x * Math.cos(spreadAngle) - baseDir.y * Math.sin(spreadAngle),
                                baseDir.x * Math.sin(spreadAngle) + baseDir.y * Math.cos(spreadAngle)
                            );

                            add([
                                circle(6),
                                color(250, 204, 21),
                                outline(1, rgb(217, 119, 6)),
                                pos(player.pos),
                                area(),
                                move(bulletDir, gameState.projectileSpeed),
                                anchor("center"),
                                "bullet",
                                { damage: gameState.attackDamage, dir: bulletDir }
                            ]);
                        }
                    };

                    fireBullet();

                    if (gameState.activeMythics.includes("⌛ Chrono Echo")) {
                        let stacks = gameState.mythicStacks["⌛ Chrono Echo"] || 1;
                        for (let s = 1; s <= stacks; s++) {
                            wait(0.12 * s, () => {
                                if (!gameState.isPaused && enemies.length > 0) fireBullet();
                            });
                        }
                    }
                }
            }
            gameState.attackTimer = 0;
        }
    });

    onCollide("bullet", "enemy", (bullet, enemy) => {
        if (gameState.isPaused) return;

        destroy(bullet);
        let damageDealt = bullet.damage;

        if (gameState.activeMythics.includes("🌟 Supernova Core")) {
            let stacks = gameState.mythicStacks["🌟 Supernova Core"] || 1;
            if (Math.random() < 0.20 + (stacks * 0.1)) {
                damageDealt *= (4 + stacks);
            }
        }

        if (gameState.activeMythics.includes("🧊 Zero Kelvin Dilation")) {
            let stacks = gameState.mythicStacks["🧊 Zero Kelvin Dilation"] || 1;
            if (Math.random() < 0.25 + (stacks * 0.1)) {
                damageDealt *= 2; 
                enemy.color = rgb(147, 197, 253);
            }
        }

        if (gameState.activeMythics.includes("🎯 Executioner's Mark")) {
            let stacks = gameState.mythicStacks["🎯 Executioner's Mark"] || 1;
            let threshold = 0.25 + (stacks * 0.05);
            if ((enemy.hp / (2 + Math.floor(gameState.level * 0.7))) <= threshold) {
                damageDealt = 9999;
            }
        }

        enemy.hp -= damageDealt;
        playSound('hit');

        if (gameState.activeMythics.includes("⚡ Chain Lightning Mastery")) {
            let stacks = gameState.mythicStacks["⚡ Chain Lightning Mastery"] || 1;
            let maxChains = 2 + stacks;
            let chained = 0;
            get("enemy").forEach(nearEnemy => {
                if (nearEnemy !== enemy && chained < maxChains && nearEnemy.pos.dist(enemy.pos) < 200) {
                    nearEnemy.hp -= (damageDealt * (0.6 + stacks * 0.1));
                    chained++;
                }
            });
        }

        if (gameState.activeMythics.includes("🩸 Blood Sovereign")) {
            let stacks = gameState.mythicStacks["🩸 Blood Sovereign"] || 1;
            let healAmt = damageDealt * (0.10 * stacks);
            gameState.hp = Math.min(gameState.maxHp, gameState.hp + healAmt);
            hpText.text = `HP: ${Math.ceil(gameState.hp)}/${gameState.maxHp}`;
        }

        if (enemy.hp <= 0) {
            if (gameState.activeMythics.includes("☣️ Plague Spore Aura")) {
                let stacks = gameState.mythicStacks["☣️ Plague Spore Aura"] || 1;
                const toxicPos = enemy.pos;
                const cloud = add([
                    circle(50 + stacks * 15),
                    color(34, 197, 94),
                    opacity(0.6),
                    pos(toxicPos),
                    anchor("center"),
                    z(30)
                ]);
                wait(0.3, () => destroy(cloud));

                get("enemy").forEach(nearEnemy => {
                    if (nearEnemy !== enemy && nearEnemy.pos.dist(toxicPos) < 50 + stacks * 15) {
                        nearEnemy.hp -= (4 * stacks);
                    }
                });
            }

            let gemValue = 1 + Math.floor(gameState.level * 0.3);
            if (gameState.activeMythics.includes("🧲 Quantum Gravity Well")) {
                let stacks = gameState.mythicStacks["🧲 Quantum Gravity Well"] || 1;
                gemValue = Math.floor(gemValue * (1.5 + stacks * 0.5));
            }

            add([
                circle(6 + Math.min(6, gemValue)),
                color(52, 211, 153),
                outline(2, rgb(16, 185, 129)),
                pos(enemy.pos),
                area(),
                anchor("center"),
                "gem",
                { value: gemValue }
            ]);

            destroy(enemy);
            gameState.kills++;
            killText.text = `KILLS: ${gameState.kills}`;

            if (gameState.activeAbilities.includes("Vampiric Siphon") && gameState.kills % 5 === 0) {
                gameState.hp = Math.min(gameState.maxHp, gameState.hp + 1);
                hpText.text = `HP: ${Math.ceil(gameState.hp)}/${gameState.maxHp}`;
            }
        }
    });

    player.onCollide("enemy", (enemy) => {
        if (gameState.isPaused) return;
        if (gameState.godMode || invulnerableTimer > 0) return;

        let dmg = 10;
        if (gameState.activeMythics.includes("🛡️ Titanium Sentinel")) {
            let stacks = gameState.mythicStacks["🛡️ Titanium Sentinel"] || 1;
            dmg = Math.max(1, dmg * Math.pow(0.7, stacks));
        }

        gameState.hp -= dmg;
        playSound('hurt');

        if (gameState.hp <= 0 && gameState.activeMythics.includes("🔥 Hellfire Phoenix")) {
            let stacks = gameState.mythicStacks["🔥 Hellfire Phoenix"] || 1;
            if (gameState.mythicStacks["🔥 Hellfire Phoenix_revives"] === undefined) {
                gameState.mythicStacks["🔥 Hellfire Phoenix_revives"] = 0;
            }

            if (gameState.mythicStacks["🔥 Hellfire Phoenix_revives"] < stacks) {
                gameState.mythicStacks["🔥 Hellfire Phoenix_revives"]++;
                gameState.hp = gameState.maxHp * 0.5;
                playSound('mythic');
                get("enemy").forEach(e => destroy(e));
                hpText.text = `HP: ${Math.ceil(gameState.hp)}/${gameState.maxHp}`;
                return;
            }
        }

        if (gameState.activeMythics.includes("💥 Supernova Overdrive") && (gameState.hp / gameState.maxHp) < 0.30 && emergencyCooldown <= 0) {
            let stacks = gameState.mythicStacks["💥 Supernova Overdrive"] || 1;
            invulnerableTimer = 4.0 + (stacks * 2.0);
            emergencyCooldown = 25.0;
            playSound('mythic');

            get("enemy").forEach(e => destroy(e));
        }

        hpText.text = `HP: ${Math.max(0, Math.ceil(gameState.hp))}/${gameState.maxHp}`;

        let pushForce = gameState.activeAbilities.includes("Thorn Armor") ? 120 : 50;
        const pushDir = enemy.pos.sub(player.pos).unit();
        enemy.pos = enemy.pos.add(pushDir.scale(pushForce));

        if (gameState.activeAbilities.includes("Thorn Armor")) {
            enemy.hp -= 2;
        }

        if (gameState.hp <= 0) {
            cheatOverlay.remove();
            go("gameover", { kills: gameState.kills, level: gameState.level });
        }
    });
});

scene("gameover", (stats) => {
    add([
        text("YOU WERE OVERWHELMED", { size: 52 }),
        pos(center().x, center().y - 60),
        anchor("center"),
        color(239, 68, 68),
    ]);

    add([
        text(`Reached Level ${stats.level} | Defeated ${stats.kills} Enemies`, { size: 26 }),
        pos(center().x, center().y + 10),
        anchor("center"),
        color(226, 232, 240),
    ]);

    add([
        text("Press SPACE or TAP to Play Again", { size: 22 }),
        pos(center().x, center().y + 80),
        anchor("center"),
        color(148, 163, 184),
    ]);

    onKeyPress("space", () => go("main"));
    onClick(() => go("main"));
});

go("main");