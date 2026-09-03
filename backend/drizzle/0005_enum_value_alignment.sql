-- Align enum labels written by the former SQLAlchemy models.
--
-- SQLAlchemy persisted enum member names by default. That made members such
-- as PostType.ARTICLE and ReactionType.HELPFUL arrive in PostgreSQL as
-- uppercase labels, while the TypeScript/Drizzle application uses the
-- lowercase values from the API contract. Only the known legacy labels below
-- are touched. Canonical databases are a no-op.
DO $$
DECLARE
  item record;
  has_legacy boolean;
  has_canonical boolean;
BEGIN
  -- Check the complete mapping before changing anything. If a database has
  -- both spellings, silently choosing one would leave existing rows and the
  -- enum definition ambiguous, so fail with an actionable diagnostic.
  FOR item IN
    SELECT *
      FROM (VALUES
        ('userrole', 'GUEST', 'guest'),
        ('userrole', 'USER', 'user'),
        ('userrole', 'DOCTOR', 'doctor'),
        ('userrole', 'MODERATOR', 'moderator'),
        ('userrole', 'ADMIN', 'admin'),
        ('posttype', 'ARTICLE', 'article'),
        ('posttype', 'QUESTION', 'question'),
        ('posttype', 'REVIEW', 'review'),
        ('posttype', 'SHARE', 'share'),
        ('poststatus', 'PENDING', 'pending'),
        ('poststatus', 'APPROVED', 'approved'),
        ('poststatus', 'REJECTED', 'rejected'),
        ('reactiontype', 'HELPFUL', 'helpful'),
        ('reactiontype', 'LIKE', 'like'),
        ('reactiontype', 'INFORMATIVE', 'informative'),
        ('reportstatus', 'OPEN', 'open'),
        ('reportstatus', 'RESOLVED', 'resolved'),
        ('reportstatus', 'DISMISSED', 'dismissed'),
        ('reporttargettype', 'POST', 'post'),
        ('reporttargettype', 'COMMENT', 'comment'),
        ('reporttargettype', 'USER', 'user'),
        ('reporttargettype', 'STORY', 'story'),
        ('verificationstatus', 'PENDING', 'pending'),
        ('verificationstatus', 'APPROVED', 'approved'),
        ('verificationstatus', 'REJECTED', 'rejected')
      ) AS mapping(enum_name, legacy_label, canonical_label)
  LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM pg_type
       WHERE typnamespace = 'public'::regnamespace
         AND typname = item.enum_name
    ) THEN
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typnamespace = 'public'::regnamespace
         AND t.typname = item.enum_name
         AND e.enumlabel = item.legacy_label
    ) INTO has_legacy;
    SELECT EXISTS (
      SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typnamespace = 'public'::regnamespace
         AND t.typname = item.enum_name
         AND e.enumlabel = item.canonical_label
    ) INTO has_canonical;

    IF has_legacy AND has_canonical THEN
      RAISE EXCEPTION
        'Enum public.% contains both legacy value "%" and canonical value "%"; resolve the mixed labels before retrying the migration',
        item.enum_name, item.legacy_label, item.canonical_label
        USING ERRCODE = 'duplicate_object';
    END IF;
  END LOOP;

  -- The preflight above guarantees each rename has an unused destination.
  FOR item IN
    SELECT *
      FROM (VALUES
        ('userrole', 'GUEST', 'guest'),
        ('userrole', 'USER', 'user'),
        ('userrole', 'DOCTOR', 'doctor'),
        ('userrole', 'MODERATOR', 'moderator'),
        ('userrole', 'ADMIN', 'admin'),
        ('posttype', 'ARTICLE', 'article'),
        ('posttype', 'QUESTION', 'question'),
        ('posttype', 'REVIEW', 'review'),
        ('posttype', 'SHARE', 'share'),
        ('poststatus', 'PENDING', 'pending'),
        ('poststatus', 'APPROVED', 'approved'),
        ('poststatus', 'REJECTED', 'rejected'),
        ('reactiontype', 'HELPFUL', 'helpful'),
        ('reactiontype', 'LIKE', 'like'),
        ('reactiontype', 'INFORMATIVE', 'informative'),
        ('reportstatus', 'OPEN', 'open'),
        ('reportstatus', 'RESOLVED', 'resolved'),
        ('reportstatus', 'DISMISSED', 'dismissed'),
        ('reporttargettype', 'POST', 'post'),
        ('reporttargettype', 'COMMENT', 'comment'),
        ('reporttargettype', 'USER', 'user'),
        ('reporttargettype', 'STORY', 'story'),
        ('verificationstatus', 'PENDING', 'pending'),
        ('verificationstatus', 'APPROVED', 'approved'),
        ('verificationstatus', 'REJECTED', 'rejected')
      ) AS mapping(enum_name, legacy_label, canonical_label)
  LOOP
    IF EXISTS (
      SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typnamespace = 'public'::regnamespace
         AND t.typname = item.enum_name
         AND e.enumlabel = item.legacy_label
    ) THEN
      EXECUTE format(
        'ALTER TYPE %I.%I RENAME VALUE %L TO %L',
        'public', item.enum_name, item.legacy_label, item.canonical_label
      );
    END IF;
  END LOOP;
END $$;
