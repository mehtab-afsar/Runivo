-- ============================================================
-- Races: starter list of upcoming Indian races (checked 17 Nov 2026)
-- ============================================================
-- Each date is confirmed by the AIMS race calendar or the organiser;
-- distances come from the organiser or race listings. Races whose date
-- or distances conflicted between sources were left out (Indore,
-- Durgapur, KD Amdavad, Bodhgaya, Run Bhopal Run, Auroville).
-- For the later 2027 races only the distance in the race's name is
-- listed until the organiser publishes categories.
--
-- Curated and approved; coordinates are the start city's centre (used
-- only to sort "near you"). Safe to re-run: a race with the same name
-- and date is skipped.

do $$
declare
  r record;
  v_race uuid;
  d integer;
begin
  for r in
    select * from (values
      ('Adani Ahmedabad Marathon',        'Ahmedabad', 23.0225, 72.5714, date '2026-11-29', 'https://www.ahmedabadmarathon.com',        array[42195, 21097, 10000, 5000]),
      ('JBG Kolkata Marathon',            'Kolkata',   22.5726, 88.3639, date '2026-11-29', 'https://www.jbgkolkatamarathon.com',       array[42195, 21097, 10000, 5000]),
      ('Vedanta Pink City Half Marathon', 'Jaipur',    26.9124, 75.7873, date '2026-11-29', 'https://pinkcitymarathon.com',             array[21097, 10000, 5000]),
      ('Bharat Midnight Marathon',        'Bengaluru', 12.9850, 77.7280, date '2026-12-05', 'https://midnightmarathon.in',              array[42195, 31600, 21097, 10000, 5000]),
      ('Pune International Marathon',     'Pune',      18.5204, 73.8567, date '2026-12-06', 'https://www.marathonpune.com',             array[42195, 21097, 10000, 5000]),
      ('SKF Goa River Marathon',          'Goa',       15.4000, 73.8400, date '2026-12-13', 'https://www.skfgoarivermarathon.com',      array[42195, 32186, 21097, 10000, 5000]),
      ('Tata Steel World 25K Kolkata',    'Kolkata',   22.5726, 88.3639, date '2026-12-20', 'https://tatasteelworld25k.procam.in',      array[25000, 10000]),
      ('Freshworks Chennai Marathon',     'Chennai',   13.0827, 80.2707, date '2027-01-03', 'https://www.thechennaimarathon.com',       array[42195, 32186, 21097, 10000]),
      ('Tata Mumbai Marathon',            'Mumbai',    19.0760, 72.8777, date '2027-01-17', 'https://tatamumbaimarathon.procam.in',     array[42195, 21097, 10000]),
      ('MG Vadodara International Marathon', 'Vadodara', 22.3072, 73.1812, date '2027-02-07', 'https://www.vadodaramarathon.com',      array[42195, 21097, 10000, 5000]),
      ('AU Jaipur Marathon',              'Jaipur',    26.9124, 75.7873, date '2027-02-14', 'https://www.marathonjaipur.com',           array[42195, 21097, 10000, 5000]),
      ('IEM-UEM Kolkata Marathon',        'Kolkata',   22.5726, 88.3639, date '2027-02-21', 'https://iemuemkolkatamarathon.org',        array[42195, 21097]),
      ('Cognizant New Delhi Marathon',    'New Delhi', 28.6139, 77.2090, date '2027-02-28', 'https://www.newdelhimarathon.com',         array[42195, 21097, 10000, 5000]),
      ('TCS World 10K Bengaluru',         'Bengaluru', 12.9716, 77.5946, date '2027-04-25', 'https://tcsworld10k.procam.in',            array[10000]),
      ('NMDC Hyderabad Marathon',         'Hyderabad', 17.3850, 78.4867, date '2027-08-28', 'https://nmdchyderabadmarathon.com',        array[42195]),
      ('Mumbai Half Marathon',            'Mumbai',    19.0760, 72.8777, date '2027-08-29', 'https://www.mumbaihalfmarathon.com',       array[21097]),
      ('Vedanta Zinc City Half Marathon', 'Udaipur',   24.5854, 73.7125, date '2027-09-05', 'https://vedantazchm.abcr.in',              array[21097]),
      ('Sekhon Indian Air Force Marathon', 'New Delhi', 28.6139, 77.2090, date '2027-10-03', 'https://sekhoniafmarathon.in',            array[42195])
    ) as t(name, city, lat, lng, starts_on, url, distances)
  loop
    if exists (select 1 from public.races where name = r.name and starts_on = r.starts_on) then continue; end if;
    insert into public.races (name, city, lat, lng, starts_on, website_url, source, status, checked_at)
    values (r.name, r.city, r.lat, r.lng, r.starts_on, r.url, 'curated', 'approved', now())
    returning id into v_race;
    foreach d in array r.distances loop
      insert into public.race_distances (race_id, distance_m, label) values (v_race, d, public.race_distance_label(d));
    end loop;
  end loop;
end $$;
