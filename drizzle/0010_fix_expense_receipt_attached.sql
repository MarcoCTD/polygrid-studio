UPDATE expenses
SET receipt_attached = 0
WHERE receipt_file_path IS NULL
   OR trim(receipt_file_path) = '';
