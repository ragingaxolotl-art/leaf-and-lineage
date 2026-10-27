# Portable beetle DNA

Select a beetle and choose **Copy beetle DNA**. Paste the complete string into **Import beetle DNA**, review its portrait, and choose **Recreate beetle in my tank**. A text file can also hold the string. Both the hosted and self-contained offline lab support this format.

The string preserves all 113 paired loci, both hidden and expressed copies, expression weights, and the development seed. The seed fixes the individual shape and placement of markings. It includes the inherited controls for density, mark size and stretch, symmetry, front/back and edge/center bias, clustering, jitter, and the second layer. Repeated decoding produces the same genome and SVG geometry. Browser antialiasing and screen color profiles can differ.

DNA describes the inherited beetle. Names, ancestry records, mutations' historical labels, learned favorite places, relationships, and current activity remain tank records. Imported beetles get new local IDs and begin a new family record. The sender retains the original. Full JSON/tank exports remain available for historical records.

## PLDNA1 wire contract

`PLDNA1.<base64url payload>.<8 lowercase hexadecimal CRC32 digits>`

The complete code is 2,500 ASCII characters. Wrapping whitespace is accepted on input. The 1,863-byte payload contains:

- One byte: phenotype/appearance model version (1).
- Four bytes: uint32 development seed, little-endian, including 0 and 4294967295.
- Both gene copies, chromosome A through K, in the permanent order recorded in `dna.js`.
- Number alleles: IEEE-754 Float64, little-endian, without decimal rounding.
- Category alleles: one-byte frozen category index and a Float64 expression weight.
- Color alleles: three RGB bytes and a Float64 expression weight.

The checksum uses standard CRC32 over the decoded payload. It detects accidental damage, not ownership or authenticity. Decoders require canonical unpadded base64url, exact length, supported versions and legal gene values. Input is bounded before decoding. A failed import cannot replace the current tank; device persistence finishes before the new tank is shown. Overflow uses Nursery.

## Compatibility

PLDNA1 freezes the existing genetic schema and appearance model. `beetles.js` routes model 1 through `drawV1`; its geometry and seeded random-number consumption must remain stable. The V1 golden tests cover all four marking shapes, phenotype calculation, both layers and exact SVG output. Existing tank files default to model 1; imports store `appearanceVersion: 1` explicitly.

Do not repurpose PLDNA1 indices, add rounding, change V1 phenotype expression, or change V1 seed consumption. A new model must keep the old decoding/rendering behavior available or explicitly reject an incompatible version. `assertSchema` refuses schema drift instead of silently creating a different beetle. Older packet formats are upgraded through the existing validated neutral defaults before encoding.

Validation: `node --test tests/dna.test.cjs` and the complete repository test suite. Browser checks cover export, copy status, damaged code blocking, import preview, an exact redraw and re-encoding, separate-origin offline import, and persistence after reload.
