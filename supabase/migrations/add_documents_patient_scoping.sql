-- Ajoute le scoping patient_id sur la table documents et la fonction RPC
-- match_patient_documents, utilisées par le RAG patient dans /api/chat.

-- 1. Colonne patient_id (nullable = document praticien global / "protocole")
ALTER TABLE documents ADD COLUMN IF NOT EXISTS patient_id uuid;

CREATE INDEX IF NOT EXISTS documents_patient_id_idx ON documents (patient_id);

-- 2. Fonction de recherche vectorielle scoping patient
-- Recherche les chunks de documents appartenant spécifiquement à un patient
-- (documents de type "patient", anonymisés à l'upload).
CREATE OR REPLACE FUNCTION match_patient_documents(
  query_embedding vector(768),
  patient_id_param uuid,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    documents.id,
    documents.content,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE documents.patient_id = patient_id_param
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
$$;
