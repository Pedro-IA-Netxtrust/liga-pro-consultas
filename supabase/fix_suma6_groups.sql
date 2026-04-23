-- Solución para la categoría Varones Suma 6 (ID: b4dbcd31-b694-4d99-b982-34370e406ee1)
-- Se detectó que los partidos estaban generados pero sin asociación a un grupo.

-- 1. Crear el grupo para la categoría (Si no existe)
DO $$
DECLARE
    new_group_id UUID;
    cat_id UUID := 'b4dbcd31-b694-4d99-b982-34370e406ee1';
BEGIN
    -- Intentar obtener el ID si ya existe o crear uno nuevo
    SELECT id INTO new_group_id FROM league_groups WHERE league_category_id = cat_id AND group_name = 'Grupo A' LIMIT 1;
    
    IF new_group_id IS NULL THEN
        INSERT INTO league_groups (league_category_id, group_name, phase) 
        VALUES (cat_id, 'Grupo A', 1) 
        RETURNING id INTO new_group_id;
    END IF;

    -- 2. Vincular los partidos al grupo
    UPDATE league_matches 
    SET league_group_id = new_group_id
    WHERE league_category_id = cat_id AND league_group_id IS NULL;

    -- 3. Vincular las parejas al grupo en la tabla de posiciones (evitando duplicados)
    INSERT INTO league_group_teams (league_group_id, league_team_id, position) 
    SELECT new_group_id, id, 0 
    FROM league_teams 
    WHERE league_category_id = cat_id
    AND id NOT IN (SELECT league_team_id FROM league_group_teams WHERE league_group_id = new_group_id);

END $$;
