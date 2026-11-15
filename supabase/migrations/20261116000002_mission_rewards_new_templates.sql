-- Two missions in MISSION_TEMPLATES (packages/shared/src/services/missions.ts) had no
-- entry in mission_pace_reward(): "New Route" and "Chart New Ground". The function
-- returned NULL for them, so claim_mission_reward could not pay them out.
-- packages/shared/src/services/missionRewards.test.ts now fails if the two lists differ.

CREATE OR REPLACE FUNCTION public.mission_pace_reward(p_title text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_title
    WHEN 'Morning Miles'      THEN 4
    WHEN 'Land Grab'          THEN 5
    WHEN 'Calorie Crusher'    THEN 7
    WHEN 'Steady State'       THEN 6
    WHEN 'Push Further'       THEN 10
    WHEN 'Territorial'        THEN 12
    WHEN 'Hostile Takeover'   THEN 8
    WHEN 'Speed Demon'        THEN 9
    WHEN 'Fat Burn Zone'      THEN 15
    WHEN 'Defend Your Turf'   THEN 20
    WHEN 'Endurance Test'     THEN 25
    WHEN 'Empire Builder'     THEN 30
    WHEN 'War Machine'        THEN 40
    WHEN 'Long Haul'          THEN 35
    WHEN 'Sprint Intervals'   THEN 22
    WHEN 'Take Their Ground'  THEN 30
    WHEN 'Fuel Right'         THEN 15
    WHEN 'New Route'          THEN 6
    WHEN 'Chart New Ground'   THEN 9
    ELSE NULL
  END;
$$;
