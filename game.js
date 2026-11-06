// --- MYTHIC PROTOCOL: MAIN GAME SCRIPT ---
const k = kaplay({
    width: 1280,
    height: 720,
    letterbox: true,
    background: [15, 23, 42],
    global: true,
});

loadSprite("spudling", "enemy.png");
loadSprite("miniboss", "mini_boss.png");
loadSprite("finalboss", "final_boss.png");

scene("main", () => {
    const gameState = {
        isPaused: false,
        godMode: false,
        maxHp: 100,
        hp: 100,
        xp: 0,
        level: 1,
        xpToNextLevel: 18, // Increased initial XP requirement for balanced progression
        kills: 0,
        gold: 15,
        totalGoldSpent: 0,
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        currentWave: 1,
        waveTimer: 35, // 35s wave timer
        isWaveActive: true,
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

    let miniBossSpawned = false;
    let finalBossSpawned = false;

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

    const xpBarBg = uiBox.add([
        rect(300, 14, { radius: 4 }),
        pos(30, 85),
        color(30, 41, 59),
        outline(2, rgb(71, 85, 105)),
    ]);

    const xpBarFill = uiBox.add([
        rect(0, 14, { radius: 4 }),
        pos(30, 85),
        color(59, 130, 246),
    ]);

    function updateXpBar() {
        const pct = Math.min(1, gameState.xp / gameState.xpToNextLevel);
        xpBarFill.width = 300 * pct;
        levelText.text = `LVL: ${gameState.level} (XP: ${gameState.xp}/${gameState.xpToNextLevel})`;
    }

    const killText = uiBox.add([
        text(`KILLS: ${gameState.kills} | GOLD: $${gameState.gold}`, { size: 22 }),
        pos(30, 108),
        color(251, 191, 36),
    ]);

    const waveText = uiBox.add([
        text(`WAVE: ${gameState.currentWave} (Time: 35s)`, { size: 22 }),
        pos(30, 138),
        color(168, 85, 247),
    ]);

    const bossIndicator = uiBox.add([
        text("", { size: 20 }),
        pos(center().x, 60),
        anchor("center"),
        color(239, 68, 68),
        opacity(0),
    ]);

    const traitsContainer = uiBox.add([pos(30, 168)]);

    const tooltipBox = uiBox.add([
        rect(240, 60, { radius: 6 }),
        color(15, 23, 42),
        outline(2, rgb(168, 85, 247)),
        pos(30, 208),
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

        get("gem").forEach(g => {
            if (g.pos.dist(player.pos) < gameState.magnetRadius || gameState.activeMythics.includes("Void Singularity")) {
                g.move(player.pos.sub(g.pos).unit().scale(350));
            }
        });
    });

    player.onCollide("gem", (gem) => {
        destroy(gem);
        playSound('gem');
        gameState.xp += (gem.value || 0.5);
        gameState.gold += (gem.value || 0.5);
        killText.text = `KILLS: ${gameState.kills} | GOLD: $${gameState.gold.toFixed(2)}`;

        if (gameState.xp >= gameState.xpToNextLevel) {
            gameState.level++;
            gameState.xp -= gameState.xpToNextLevel;
            gameState.xpToNextLevel = Math.floor(gameState.xpToNextLevel * 1.65); // Slower XP scaling
            playSound('levelup');
            showLevelUpMenu();
        }
        updateXpBar();
    });

    function showLevelUpMenu() {
        gameState.isPaused = true;
        
        const menuOverlay = uiBox.add([
            rect(1280, 720),
            color(15, 23, 42),
            opacity(0.92),
            fixed(),
            z(300),
            area(),
        ]);

        menuOverlay.add([
            text(`LEVEL UP! (LEVEL ${gameState.level})`, { size: 36 }),
            pos(center().x, 80),
            anchor("center"),
            color(59, 130, 246),
        ]);

        menuOverlay.add([
            text("Choose a Free Skill / Ability Boost", { size: 20 }),
            pos(center().x, 120),
            anchor("center"),
            color(203, 213, 225),
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

            const card = menuOverlay.add([
                rect(320, 350, { radius: 12 }),
                pos(cardX, cardY),
                anchor("center"),
                color(30, 41, 59),
                outline(4, option.color),
                area(),
            ]);

            card.add([
                text(option.rarity.toUpperCase(), { size: 16 }),
                pos(0, -130),
                anchor("center"),
                color(option.color),
            ]);

            card.add([
                text(option.name, { size: 18, width: 280, align: "center" }),
                pos(0, -90),
                anchor("center"),
                color(255, 255, 255),
            ]);

            card.add([
                text(option.desc, { size: 15, width: 260, align: "center" }),
                pos(0, -10),
                anchor("center"),
                color(203, 213, 225),
            ]);

            const chooseBtn = card.add([
                rect(240, 48, { radius: 8 }),
                pos(0, 110),
                anchor("center"),
                color(option.color),
            ]);

            chooseBtn.add([
                text("SELECT ABILITY", { size: 15 }),
                pos(0, 0),
                anchor("center"),
                color(15, 23, 42),
            ]);

            card.onClick(() => {
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

        let moveDir = vec2(0, 0);
        if (isKeyDown("left") || isKeyDown("a")) moveDir.x -= 1;
        if (isKeyDown("right") || isKeyDown("d")) moveDir.x += 1;
        if (isKeyDown("up") || isKeyDown("w")) moveDir.y -= 1;
        if (isKeyDown("down") || isKeyDown("s")) moveDir.y += 1;

        if (moveDir.len() > 0) {
            moveDir = moveDir.unit();
            player.move(moveDir.scale(gameState.playerSpeed));
        }
    });

    let consoleOpen = false;
    const cheatOverlay = document.createElement('div');
    cheatOverlay.style.cssText = 'display:none; position:fixed; top:20px; left:50%; transform:translateX(-50%); width:520px; background:rgba(15, 23, 42, 0.95); border:2px solid #a855f7; border-radius:8px; padding:15px; z-index:99999; font-family:sans-serif; box-shadow:0 10px 25px rgba(0,0,0,0.7);';
    cheatOverlay.innerHTML = `
        <div style="color:#a855f7; font-weight:bold; margin-bottom:8px; font-size:16px;">🛠️ DEV CHEAT CONSOLE</div>
        <div style="color:#94a3b8; font-size:12px; margin-bottom:10px;">Commands: <b style="color:#f8fafc">godmode</b>, <b style="color:#f8fafc">gold (num)</b>, <b style="color:#f8fafc">addxp (num)</b>, <b style="color:#f8fafc">jumplevel (num)</b>, <b style="color:#f8fafc">skipwave (num)</b>, <b style="color:#f8fafc">addhp (num)</b>, <b style="color:#f8fafc">speed (num)</b>, <b style="color:#f8fafc">killall</b>, <b style="color:#f8fafc">levelup</b></div>
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
            } else if (action === 'gold') {
                gameState.gold += (val > 0 ? val : 500);
                killText.text = `KILLS: ${gameState.kills} | GOLD: $${gameState.gold}`;
            } else if (action === 'addxp') {
                gameState.xp += (val > 0 ? val : 10);
                if (gameState.xp >= gameState.xpToNextLevel) {
                    gameState.level++;
                    gameState.xp = 0;
                    gameState.xpToNextLevel = Math.floor(gameState.xpToNextLevel * 1.5);
                    consoleOpen = false;
                    cheatOverlay.style.display = 'none';
                    showLevelUpMenu();
                }
                updateXpBar();
            } else if (action === 'jumplevel') {
                if (val > 0) {
                    gameState.level = val;
                    gameState.xp = 0;
                    gameState.xpToNextLevel = Math.floor(10 * Math.pow(1.5, gameState.level - 1));
                    consoleOpen = false;
                    cheatOverlay.style.display = 'none';
                    showLevelUpMenu();
                }
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
                gameState.xpToNextLevel = Math.floor(gameState.xpToNextLevel * 1.5);
                consoleOpen = false;
                cheatOverlay.style.display = 'none';
                showLevelUpMenu();
            } else if (action === 'skipwave') {
                gameState.currentWave = (val > 0 ? val : gameState.currentWave + 1);
                gameState.waveTimer = gameState.currentWave === 10 ? 120 : (gameState.currentWave === 20 ? 180 : 35);
                miniBossSpawned = false;
                finalBossSpawned = false;
                get("enemy").forEach(e => destroy(e));
                consoleOpen = false;
                cheatOverlay.style.display = 'none';
                gameState.isPaused = false;
                gameState.isWaveActive = true;
                waveText.text = `WAVE: ${gameState.currentWave} (Time: ${gameState.waveTimer}s)`;
            }
            cheatInput.value = '';
        }
    });

    let spawnTimer = 0;
    onUpdate(() => {
        if (gameState.isPaused || !gameState.isWaveActive) return;

        const isBossWave = (gameState.currentWave === 10 || gameState.currentWave === 20);

        if (!isBossWave) {
            gameState.waveTimer -= dt();
            waveText.text = `WAVE: ${gameState.currentWave} (Time: ${Math.max(0, Math.ceil(gameState.waveTimer))}s)`;
            bossIndicator.opacity = 0;

            if (gameState.waveTimer <= 0) {
                get("enemy").forEach(e => destroy(e));
                startShopPhase(false);
                return;
            }
        } else {
            gameState.waveTimer -= dt();
            const bossList = get("boss");
            const bName = gameState.currentWave === 10 ? "MINI-BOSS" : "FINAL BOSS";

            if (bossList.length > 0) {
                const b = bossList[0];
                const dirToBoss = b.pos.sub(player.pos);
                bossIndicator.opacity = 1;
                const angle = dirToBoss.angle();
                bossIndicator.pos = center().add(vec2(Math.cos(angle * Math.PI / 180) * 320, Math.sin(angle * Math.PI / 180) * 220));
                bossIndicator.text = `⚠️ ${bName} (${Math.round(dirToBoss.len())}m) ➔`;
                waveText.text = `WAVE: ${gameState.currentWave} (DEFEAT ${bName}! ${Math.max(0, Math.ceil(gameState.waveTimer))}s)`;
            } else {
                bossIndicator.opacity = 0;
                waveText.text = `WAVE: ${gameState.currentWave} (Time: ${Math.max(0, Math.ceil(gameState.waveTimer))}s)`;
            }

            // 120s / 180s Time Out Handler: If time runs out, boss retreats and player gets regular shop
            if (gameState.waveTimer <= 0) {
                get("enemy").forEach(e => destroy(e));
                bossIndicator.opacity = 0;
                startShopPhase(false);
                return;
            }
        }

        get("enemy").forEach((e) => {
            const dir = player.pos.sub(e.pos).unit();
            e.move(dir.scale(e.speed));

            if (e.isMiniBoss) {
                e.bossAttackTimer = (e.bossAttackTimer || 0) + dt();
                if (e.bossAttackTimer >= 2.5) {
                    playSound('shoot');
                    add([
                        circle(10),
                        color(239, 68, 68),
                        outline(2, rgb(255, 255, 255)),
                        pos(e.pos),
                        area(),
                        move(dir, 160),
                        anchor("center"),
                        "enemy_bullet",
                        { damage: 15 }
                    ]);
                    e.bossAttackTimer = 0;
                }
            }

            if (e.isFinalBoss) {
                e.bossAttackTimer = (e.bossAttackTimer || 0) + dt();
                if (e.bossAttackTimer >= 1.5) {
                    playSound('shoot');
                    for (let i = -1; i <= 1; i++) {
                        const spreadAngle = i * 0.2;
                        const bulletDir = vec2(
                            dir.x * Math.cos(spreadAngle) - dir.y * Math.sin(spreadAngle),
                            dir.x * Math.sin(spreadAngle) + dir.y * Math.cos(spreadAngle)
                        );
                        add([
                            circle(8),
                            color(168, 85, 247),
                            outline(2, rgb(248, 250, 252)),
                            pos(e.pos),
                            area(),
                            move(bulletDir, 400),
                            anchor("center"),
                            "enemy_bullet",
                            { damage: 20 }
                        ]);
                    }
                    e.bossAttackTimer = 0;
                }
            }
        });

        spawnTimer += dt();
        let currentSpawnInterval = isBossWave ? 2.0 : Math.max(0.2, 0.8 - (gameState.currentWave * 0.03));

        if (spawnTimer >= currentSpawnInterval) {
            const angle = rand(0, Math.PI * 2);
            const distance = rand(800, 1100);
            const spawnPos = player.pos.add(vec2(Math.cos(angle) * distance, Math.sin(angle) * distance));

            if (spawnPos.x >= -4900 && spawnPos.x <= 4900 && spawnPos.y >= -4900 && spawnPos.y <= 4900) {
                const baseEnemyHp = 2 + Math.floor(gameState.currentWave * 1.2);
                
                // Spawn Mini-Boss exactly ONCE during Wave 10
                if (gameState.currentWave === 10 && !miniBossSpawned) {
                    miniBossSpawned = true;
                    gameState.waveTimer = 120; // Exact 2 minute timer
                    add([
                        sprite("miniboss"),
                        pos(spawnPos),
                        area(),
                        body(),
                        anchor("center"),
                        scale(0.45),
                        "enemy",
                        "boss",
                        { 
                            hp: baseEnemyHp * 10, 
                            speed: 85,
                            isMiniBoss: true,
                        }
                    ]);
                } 
                // Spawn Final Boss exactly ONCE during Wave 20
                else if (gameState.currentWave === 20 && !finalBossSpawned) {
                    finalBossSpawned = true;
                    gameState.waveTimer = 180;
                    add([
                        sprite("finalboss"),
                        pos(spawnPos),
                        area(),
                        body(),
                        anchor("center"),
                        scale(0.55),
                        "enemy",
                        "boss",
                        { 
                            hp: baseEnemyHp * 20, 
                            speed: 105,
                            isFinalBoss: true,
                        }
                    ]);
                }

                if (!isBossWave || Math.random() < 0.35) {
                    add([
                        sprite("spudling"),
                        pos(spawnPos),
                        area(),
                        body(),
                        anchor("center"),
                        scale(0.75),
                        "enemy",
                        { 
                            hp: baseEnemyHp, 
                            speed: rand(110, 140 + (gameState.currentWave * 3)),
                        }
                    ]);
                }
            }
            spawnTimer = 0;
        }
    });

    function startShopPhase(isSpecialBossShop = false) {
        gameState.isWaveActive = false;
        gameState.isPaused = true;
        bossIndicator.opacity = 0;
        
        gameState.hp = gameState.maxHp;
        hpText.text = `HP: ${Math.ceil(gameState.hp)}/${gameState.maxHp}`;

        playSound('mythic');

        let isPickedInSpecialShop = false;

        const shopOverlay = add([
            rect(1280, 720),
            color(15, 23, 42),
            opacity(0.95),
            fixed(),
            z(200),
            area(),
        ]);

        shopOverlay.add([
            text(isSpecialBossShop ? `👑 SPECIAL BOSS REWARD SHOP!` : `WAVE ${gameState.currentWave} COMPLETED!`, { size: 36 }),
            pos(center().x, 50),
            anchor("center"),
            color(isSpecialBossShop ? rgb(245, 158, 11) : rgb(52, 211, 153)),
        ]);

        const goldDisplay = shopOverlay.add([
            text(`Vanguard Supply Shop | Your Gold: $${gameState.gold.toFixed(2)}`, { size: 22 }),
            pos(center().x, 90),
            anchor("center"),
            color(251, 191, 36),
        ]);

        function renderShopCards() {
            shopOverlay.get("shop_card").forEach(c => destroy(c));

            let poolToUse = [...upgradePool, ...uniqueAbilitiesPool, ...mythicPool];
            if (isSpecialBossShop) {
                // Special Mini-boss shop pool: Only Legendary and Mythic items
                poolToUse = poolToUse.filter(item => item.rarity === "Legendary" || item.rarity === "Mythic");
            }

            const shopOptions = [];

            for (let i = 0; i < 3; i++) {
                const totalWeight = poolToUse.reduce((acc, card) => acc + card.weight, 0);
                let randomVal = Math.random() * totalWeight;
                let selected = poolToUse[0];

                for (let card of poolToUse) {
                    if (randomVal < card.weight) {
                        selected = card;
                        break;
                    }
                    randomVal -= card.weight;
                }

                let price = isSpecialBossShop ? 0 : 1;
                if (!isSpecialBossShop) {
                    if (selected.rarity === "Mythic") price = 20;
                    else if (selected.rarity === "Legendary") price = 15;
                    else if (selected.rarity === "Unique Ability") price = 10;
                    else if (selected.rarity === "Rare") price = 5;
                }

                shopOptions.push({ ...selected, price });
            }

            shopOptions.forEach((option, idx) => {
                const cardX = center().x + (idx - 1) * 360;
                const cardY = center().y + 10;

                const card = shopOverlay.add([
                    rect(320, 320, { radius: 12 }),
                    pos(cardX, cardY),
                    anchor("center"),
                    color(30, 41, 59),
                    outline(4, option.color),
                    area(),
                    "shop_card",
                ]);

                card.add([
                    text(option.rarity.toUpperCase(), { size: 16 }),
                    pos(0, -120),
                    anchor("center"),
                    color(option.color),
                ]);

                card.add([
                    text(option.name, { size: 18, width: 280, align: "center" }),
                    pos(0, -80),
                    anchor("center"),
                    color(255, 255, 255),
                ]);

                card.add([
                    text(option.desc, { size: 15, width: 260, align: "center" }),
                    pos(0, -10),
                    anchor("center"),
                    color(203, 213, 225),
                ]);

                const chooseBtn = card.add([
                    rect(240, 44, { radius: 8 }),
                    pos(0, 100),
                    anchor("center"),
                    color(gameState.gold >= option.price ? option.color : rgb(71, 85, 105)),
                ]);

                const btnText = chooseBtn.add([
                    text(isSpecialBossShop ? "CLAIM FREE REWARD" : `BUY FOR $${option.price}`, { size: 14 }),
                    pos(0, 0),
                    anchor("center"),
                    color(15, 23, 42),
                ]);

                card.onClick(() => {
                    if (isSpecialBossShop && isPickedInSpecialShop) return;
                    if (gameState.gold < option.price) return;

                    gameState.gold -= option.price;
                    gameState.totalGoldSpent += option.price;
                    goldDisplay.text = `Vanguard Supply Shop | Your Gold: $${gameState.gold.toFixed(2)}`;
                    killText.text = `KILLS: ${gameState.kills} | GOLD: $${gameState.gold.toFixed(2)}`;

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
                    chooseBtn.color = rgb(34, 197, 94);
                    btnText.text = "CLAIMED!";

                    if (isSpecialBossShop) {
                        isPickedInSpecialShop = true;
                        rerollBtn.color = rgb(71, 85, 105);
                        rerollBtnText.text = "LOCKED";
                    }
                });
            });
        }

        const rerollBtn = shopOverlay.add([
            rect(200, 45, { radius: 8 }),
            pos(center().x - 120, center().y + 260),
            anchor("center"),
            color(234, 179, 8),
            area(),
        ]);

        const rerollBtnText = rerollBtn.add([
            text(isSpecialBossShop ? "FREE REROLL" : "REROLL ($10)", { size: 15 }),
            pos(0, 0),
            anchor("center"),
            color(15, 23, 42),
        ]);

        rerollBtn.onClick(() => {
            if (isSpecialBossShop) {
                if (!isPickedInSpecialShop) {
                    renderShopCards();
                }
                return;
            }

            if (gameState.gold >= 10) {
                gameState.gold -= 10;
                gameState.totalGoldSpent += 10;
                goldDisplay.text = `Vanguard Supply Shop | Your Gold: $${gameState.gold.toFixed(2)}`;
                killText.text = `KILLS: ${gameState.kills} | GOLD: $${gameState.gold.toFixed(2)}`;
                renderShopCards();
            }
        });

        renderShopCards();

        const nextWaveBtn = shopOverlay.add([
            rect(220, 45, { radius: 8 }),
            pos(center().x + 120, center().y + 260),
            anchor("center"),
            color(52, 211, 153),
            area(),
        ]);

        nextWaveBtn.add([
            text("NEXT WAVE ➔", { size: 15 }),
            pos(0, 0),
            anchor("center"),
            color(15, 23, 42),
        ]);

        nextWaveBtn.onClick(() => {
            destroy(shopOverlay);
            gameState.currentWave++;
            miniBossSpawned = false;
            finalBossSpawned = false;
            gameState.waveTimer = gameState.currentWave === 10 ? 120 : (gameState.currentWave === 20 ? 180 : 35);
            waveText.text = `WAVE: ${gameState.currentWave} (Time: ${gameState.waveTimer}s)`;

            gameState.isPaused = false;
            gameState.isWaveActive = true;
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
                }
            }
            gameState.attackTimer = 0;
        }
    });

    onCollide("bullet", "enemy", (bullet, enemy) => {
        if (gameState.isPaused) return;

        destroy(bullet);
        let dmg = bullet.damage;
        gameState.totalDamageDealt += dmg;
        enemy.hp -= dmg;
        playSound('hit');

        if (enemy.hp <= 0) {
            let isMini = enemy.isMiniBoss;
            let isFinal = enemy.isFinalBoss;
            let isBoss = isMini || isFinal;
            let gemValue = isBoss ? 100 : 0.5;

            gameState.gold += gemValue;

            add([
                circle(isBoss ? 16 : 5),
                color(isBoss ? rgb(251, 191, 36) : rgb(52, 211, 153)),
                outline(2, isBoss ? rgb(245, 158, 11) : rgb(16, 185, 129)),
                pos(enemy.pos),
                area(),
                anchor("center"),
                "gem",
                { value: gemValue }
            ]);

            destroy(enemy);
            gameState.kills++;
            killText.text = `KILLS: ${gameState.kills} | GOLD: $${gameState.gold.toFixed(2)}`;

            // Victory upon defeating Final Boss on Wave 20
            if (isFinal) {
                cheatOverlay.remove();
                go("victory", {
                    level: gameState.level,
                    dmgDealt: Math.round(gameState.totalDamageDealt),
                    dmgTaken: Math.round(gameState.totalDamageTaken),
                    abilities: gameState.activeAbilities,
                    mythics: gameState.activeMythics,
                    mythicStacks: gameState.mythicStacks,
                    goldSpent: gameState.totalGoldSpent,
                    goldLeft: gameState.gold
                });
                return;
            }

            // Defeated Mini-Boss on Wave 10 -> Despawn mobs & open Special Boss Supply Shop!
            if (isMini) {
                get("enemy").forEach(e => destroy(e));
                startShopPhase(true);
            }
        }
    });

    player.onCollide("enemy", (enemy) => {
        if (gameState.isPaused || gameState.godMode) return;

        let dmg = 10;
        gameState.totalDamageTaken += dmg;
        gameState.hp -= dmg;
        playSound('hurt');
        hpText.text = `HP: ${Math.max(0, Math.ceil(gameState.hp))}/${gameState.maxHp}`;

        if (gameState.hp <= 0) {
            cheatOverlay.remove();
            go("gameover", { kills: gameState.kills, level: gameState.level });
        }
    });
});

scene("victory", (stats) => {
    add([
        rect(1280, 720),
        color(15, 23, 42),
    ]);

    add([
        text("🏆 VICTORY! FINAL BOSS DEFEATED! 🏆", { size: 36 }),
        pos(center().x, 45),
        anchor("center"),
        color(251, 191, 36),
    ]);

    add([
        text("Congratulations Vanguard! You successfully defended the realm against the Spud Horde!", { size: 16 }),
        pos(center().x, 80),
        anchor("center"),
        color(203, 213, 225),
    ]);

    // Spacious stats breakdown panel
    const panel = add([
        rect(1000, 480, { radius: 12 }),
        pos(center().x, center().y + 25),
        anchor("center"),
        color(30, 41, 59),
        outline(3, rgb(52, 211, 153)),
    ]);

    panel.add([
        text("📊 COMPREHENSIVE END GAME BATTLE STATISTICS & BUFFS", { size: 20 }),
        pos(0, -215),
        anchor("center"),
        color(52, 211, 153),
    ]);

    // Format detailed buffs & abilities list with names and stack counts
    let detailedBuffs = [];
    if (stats.abilities.length > 0) {
        stats.abilities.forEach(a => detailedBuffs.push(`• ${a} (Unique Ability)`));
    }
    if (stats.mythics.length > 0) {
        stats.mythics.forEach(m => {
            let stacks = stats.mythicStacks[m] || 1;
            detailedBuffs.push(`• ${m} (Mythic Trait - Stacks: x${stacks})`);
        });
    }
    if (detailedBuffs.length === 0) {
        detailedBuffs.push("• None Acquired");
    }

    const statLines = [
        `⚔️ Total Damage Dealt to Enemies: ${stats.dmgDealt.toLocaleString()}`,
        `🛡️ Total Damage Taken by Player: ${stats.dmgTaken.toLocaleString()}`,
        `⭐ Boss Defeated at Experience Level: ${stats.level}`,
        `💰 Total Gold Spent in Shop: $${stats.goldSpent} | Gold Remaining: $${stats.goldLeft}`,
        `✨ Detailed Buffs & Abilities Acquired (${detailedBuffs.length}):\n` + detailedBuffs.join("   |   ")
    ];

    statLines.forEach((line, idx) => {
        let yOffset = -160 + (idx * 45);
        if (idx === 4) yOffset = -10;

        panel.add([
            text(line, { size: 15, width: 920, align: "left" }),
            pos(-460, yOffset),
            anchor("topleft"),
            color(248, 250, 252),
        ]);
    });

    // Action Buttons nicely spaced at the bottom
    const restartBtn = add([
        rect(280, 50, { radius: 8 }),
        pos(center().x - 160, center().y + 295),
        anchor("center"),
        color(52, 211, 153),
        area(),
    ]);

    restartBtn.add([
        text("RESTART GAME", { size: 16 }),
        pos(0, 0),
        anchor("center"),
        color(15, 23, 42),
    ]);

    restartBtn.onClick(() => go("main"));

    const exitBtn = add([
        rect(280, 50, { radius: 8 }),
        pos(center().x + 160, center().y + 295),
        anchor("center"),
        color(239, 68, 68),
        area(),
    ]);

    exitBtn.add([
        text("END GAME", { size: 16 }),
        pos(0, 0),
        anchor("center"),
        color(255, 255, 255),
    ]);

    exitBtn.onClick(() => {
        window.location.reload();
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