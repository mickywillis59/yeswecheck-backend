-- ===============================================
-- Table des tokens ambigus et noms purs
-- Avec contraintes CHECK pour éviter les typos
-- ===============================================

CREATE TABLE IF NOT EXISTS ambiguous_firstnames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firstname VARCHAR(100) UNIQUE NOT NULL,
  token_type VARCHAR(20) DEFAULT 'AMBIGUOUS',
  lastname_frequency VARCHAR(20) DEFAULT 'high',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_ambiguous_firstname ON ambiguous_firstnames(firstname);
CREATE INDEX IF NOT EXISTS idx_token_type ON ambiguous_firstnames(token_type);

-- ✅ CONTRAINTES CHECK pour éviter les valeurs invalides
ALTER TABLE ambiguous_firstnames
DROP CONSTRAINT IF EXISTS chk_token_type;

ALTER TABLE ambiguous_firstnames
ADD CONSTRAINT chk_token_type
CHECK (token_type IN ('AMBIGUOUS', 'LASTNAME_ONLY'));

ALTER TABLE ambiguous_firstnames
DROP CONSTRAINT IF EXISTS chk_lastname_frequency;

ALTER TABLE ambiguous_firstnames
ADD CONSTRAINT chk_lastname_frequency
CHECK (lastname_frequency IN ('high', 'medium', 'low'));

-- ✅ Fonction trigger pour forcer lowercase automatiquement
CREATE OR REPLACE FUNCTION lowercase_firstname()
RETURNS TRIGGER AS $$
BEGIN
  NEW.firstname = LOWER(TRIM(NEW.firstname));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lowercase_firstname ON ambiguous_firstnames;

CREATE TRIGGER trigger_lowercase_firstname
BEFORE INSERT OR UPDATE ON ambiguous_firstnames
FOR EACH ROW
EXECUTE FUNCTION lowercase_firstname();

-- ===============================================
-- INSERT #1 :  NOMS PURS (LASTNAME_ONLY)
-- Quasiment jamais des prénoms, signaux forts pour pattern nom. prénom
-- ===============================================
INSERT INTO ambiguous_firstnames (firstname, token_type, lastname_frequency, notes) VALUES
-- Très haute fréquence
('dupont', 'LASTNAME_ONLY', 'high', 'Nom de famille très courant, rarement prénom'),
('durand', 'LASTNAME_ONLY', 'high', 'Nom de famille très courant, rarement prénom'),
('petit', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('leroy', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('moreau', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('lefebvre', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('lefevre', 'LASTNAME_ONLY', 'high', 'Variante de Lefebvre'),
('fournier', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('morel', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('girard', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('roux', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('bonnet', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('legrand', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('garnier', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('faure', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('rousseau', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('blanc', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('guerin', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('muller', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('roussel', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('perrin', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('morin', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('dumont', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('fontaine', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('chevalier', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('masson', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('mercier', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('garcia', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom en France'),
('martinez', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('lopez', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom'),
('sanchez', 'LASTNAME_ONLY', 'high', 'Nom de famille courant, rarement prénom')
ON CONFLICT (firstname) DO NOTHING;

-- ===============================================
-- INSERT #2 :  VRAIS AMBIGUS (AMBIGUOUS)
-- Fréquents comme prénom ET nom
-- ===============================================
INSERT INTO ambiguous_firstnames (firstname, token_type, lastname_frequency, notes) VALUES
-- Haute fréquence comme prénom ET nom
('martin', 'AMBIGUOUS', 'high', 'Nom le plus courant en France + prénom fréquent années 60-80'),
('bernard', 'AMBIGUOUS', 'high', 'Très courant comme nom et prénom (années 50-70)'),
('thomas', 'AMBIGUOUS', 'high', 'Courant comme nom et prénom (années 80-2000)'),
('robert', 'AMBIGUOUS', 'high', 'Ancien prénom (années 30-50) très courant comme nom'),
('simon', 'AMBIGUOUS', 'high', 'Courant comme nom et prénom (années 80-90)'),
('laurent', 'AMBIGUOUS', 'high', 'Courant comme nom et prénom (années 60-80)'),
('michel', 'AMBIGUOUS', 'high', 'Courant comme nom et prénom (années 40-60)'),
('david', 'AMBIGUOUS', 'high', 'Courant comme nom et prénom (années 70-90)'),
('bertrand', 'AMBIGUOUS', 'high', 'Courant comme nom et prénom (années 60-80)'),
('vincent', 'AMBIGUOUS', 'high', 'Courant comme nom et prénom (années 70-90)'),
('andre', 'AMBIGUOUS', 'high', 'Courant comme nom et prénom (années 30-50)'),
('lambert', 'AMBIGUOUS', 'high', 'Courant comme nom et prénom'),
('francois', 'AMBIGUOUS', 'high', 'Courant comme nom et prénom (années 50-70)'),
('henry', 'AMBIGUOUS', 'high', 'Courant comme nom et prénom'),
('nicolas', 'AMBIGUOUS', 'high', 'Courant comme nom et prénom (années 70-90)'),
('mathieu', 'AMBIGUOUS', 'high', 'Courant comme nom et prénom (années 80-2000)'),
('clement', 'AMBIGUOUS', 'high', 'Courant comme nom et prénom (années 90-2010)'),
('gauthier', 'AMBIGUOUS', 'high', 'Courant comme nom et prénom (années 80-2000)'),
('robin', 'AMBIGUOUS', 'high', 'Courant comme nom et prénom (années 90-2010)'),
('gerard', 'AMBIGUOUS', 'high', 'Courant comme nom et prénom (années 40-60)'),

-- Fréquence moyenne (plus souvent prénoms, mais existent comme noms)
('pierre', 'AMBIGUOUS', 'medium', 'Plus courant comme prénom mais existe comme nom'),
('paul', 'AMBIGUOUS', 'medium', 'Plus courant comme prénom mais existe comme nom'),
('louis', 'AMBIGUOUS', 'medium', 'Plus courant comme prénom (vintage revenu) mais existe comme nom'),
('julien', 'AMBIGUOUS', 'medium', 'Plus courant comme prénom (années 80-2000) mais existe comme nom'),
('jacques', 'AMBIGUOUS', 'medium', 'Plus courant comme prénom (années 40-60) mais existe comme nom'),
('denis', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom (années 50-70)'),
('pascal', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom (années 60-80)'),
('olivier', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom (années 70-90)'),
('philippe', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom (années 60-80)'),
('maurice', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom (années 30-50)'),
('christian', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom (années 50-70)'),
('sebastien', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom (années 70-90)'),
('marc', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom (années 60-80)'),
('alain', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom (années 50-70)'),
('benoit', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom (années 70-90)'),
('rene', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom (années 30-50)'),
('lucien', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom (années 30-50)'),
('frederic', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom (années 70-90)'),
('hugues', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom (années 60-80)'),
('roger', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom (années 30-50)'),
('gabriel', 'AMBIGUOUS', 'medium', 'Plus courant comme prénom (vintage revenu), rare comme nom'),
('leon', 'AMBIGUOUS', 'medium', 'Plus courant comme prénom (vintage revenu), rare comme nom'),
('edouard', 'AMBIGUOUS', 'medium', 'Plus courant comme prénom, existe comme nom'),
('albert', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom (années 30-50)'),
('emile', 'AMBIGUOUS', 'medium', 'Plus courant comme prénom (vintage revenu), rare comme nom'),
('charles', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom'),
('daniel', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom (années 50-70)'),
('patrice', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom (années 60-80)'),
('raymond', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom (années 30-50)'),
('valentin', 'AMBIGUOUS', 'medium', 'Plus courant comme prénom (années 2000+), rare comme nom'),
('noel', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom'),
('didier', 'AMBIGUOUS', 'medium', 'Courant comme nom et prénom (années 60-80)'),
('maxime', 'AMBIGUOUS', 'medium', 'Plus courant comme prénom (années 90-2010), rare comme nom')
ON CONFLICT (firstname) DO NOTHING;

-- ===============================================
-- Vérification
-- ===============================================
SELECT 
  token_type, 
  lastname_frequency,
  COUNT(*) 
FROM ambiguous_firstnames 
GROUP BY token_type, lastname_frequency
ORDER BY token_type, lastname_frequency;
