#!/usr/bin/env julia
#
# Reference computation of curricular complexity, using the tool the MA transfer
# paper used: CurricularAnalytics.jl, by the authors of the metric itself
# (Heileman et al. 2018). curricularanalytics.org is the web front end for this
# same package.
#
# This is the acceptance anchor for services/analysis/curricularComplexity.js.
# That module implements the published equations so the console figure can stay
# live; this script proves the two agree. It is not a translation of the package
# — the package is AGPL-3.0 and is used here as a dependency, not a source.
#
#   node server/scripts/exportCurricularAnalytics.js --out .ca-export
#   julia analysis/curricular_analytics.jl .ca-export
#
# Reads every curriculum CSV in the directory plus its manifest.json, and writes
# comparison.json with both implementations' numbers side by side.

using CurricularAnalytics
using JSON

function main(dir::String)
    manifest_path = joinpath(dir, "manifest.json")
    isfile(manifest_path) || error("no manifest.json in $dir — run the exporter first")
    manifest = JSON.parsefile(manifest_path)

    results = []
    mismatches = 0
    for entry in manifest["pathways"]
        file = joinpath(dir, entry["file"])
        isfile(file) || continue
        curriculum = read_csv(file)
        theirs = complexity(curriculum)[1]
        ours = entry["ours"]["complexity"]
        agree = theirs == ours
        agree || (mismatches += 1)
        push!(results, Dict(
            "file" => entry["file"],
            "uc_school_id" => entry["uc_school_id"],
            "community_college_id" => entry["community_college_id"],
            "n_courses" => entry["n_courses"],
            "theirs" => theirs,
            "ours" => ours,
            "agree" => agree,
        ))
        println(rpad(entry["file"], 16),
                "courses ", lpad(entry["n_courses"], 3),
                "   theirs ", lpad(theirs, 6),
                "   ours ", lpad(ours, 6),
                agree ? "   ok" : "   MISMATCH")
    end

    out = joinpath(dir, "comparison.json")
    open(out, "w") do io
        JSON.print(io, Dict(
            "tool" => "CurricularAnalytics.jl",
            "compared" => length(results),
            "mismatches" => mismatches,
            "pathways" => results,
        ), 2)
    end
    println("\n", length(results), " compared, ", mismatches, " mismatched -> ", out)
    exit(mismatches == 0 ? 0 : 1)
end

main(length(ARGS) >= 1 ? ARGS[1] : ".ca-export")
