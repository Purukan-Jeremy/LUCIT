from src.config.supabase import supabase


def _normalize_base64_image(value: str | None, mime_type: str) -> str | None:
    if not value:
        return None
    return f"data:{mime_type};base64,{value}"


def _infer_organ_type(result: dict) -> str:
    prediction_text = str(result.get("prediction") or "").lower()
    if "lung" in prediction_text:
        return "lung"
    if "colon" in prediction_text:
        return "colon"
    return "unknown"


def _build_prediction_label(result: dict) -> str:
    if result.get("model_type") == "segmentation":
        area_stats = result.get("area_stats") or {}
        tumor_area = area_stats.get("tumor_area", area_stats.get("cancer_pixels", 0))
        total_area = area_stats.get("total_area", area_stats.get("total_pixels", 0))
        tumor_percent = 0.0
        if total_area:
            tumor_percent = (float(tumor_area) / float(total_area)) * 100
        return f"Segmentation: {tumor_percent:.2f}% Tumor"
    return str(result.get("prediction") or "Unknown")


def _build_confidence_score(result: dict) -> float | None:
    if result.get("model_type") == "segmentation":
        area_stats = result.get("area_stats") or {}
        direct_value = area_stats.get("cancer_percent")
        if direct_value is not None:
            return float(direct_value)
        tumor_area = area_stats.get("tumor_area", area_stats.get("cancer_pixels", 0))
        total_area = area_stats.get("total_area", area_stats.get("total_pixels", 0))
        if total_area:
            return round((float(tumor_area) / float(total_area)) * 100, 4)
        return None

    confidence = result.get("confidence")
    if confidence is None:
        return None
    return round(float(confidence) * 100, 4)


def _to_history_item(row: dict) -> dict:
    organ_type = row.get("organ_type") or "unknown"
    return {
        "id": row.get("id"),
        "prediction": row.get("prediction_label") or "Unknown",
        "confidence": row.get("confidence_score"),
        "createdAt": row.get("created_at"),
        "model": "Segmentation" if row.get("feature_type") == "segmentation" else "Classification",
        "description": row.get("description") or "No AI description available.",
        "variant": organ_type if organ_type in {"lung", "colon", "breast"} else "unknown",
        "originalImage": row.get("original_image") or row.get("image_file") or "",
        "heatmapImage": row.get("heatmap_image") or row.get("segmentation_image") or "",
        "overlayImage": row.get("overlay_image") or "",
        "featureType": row.get("feature_type"),
        "organType": organ_type,
    }


class ResultRepository:
    @staticmethod
    def store_analysis_result(user_id: any, result: dict, original_image_base64: str | None = None):
        if not isinstance(result, dict) or user_id is None:
            return result

        # Ensure user_id is in correct format (Supabase usually expects int or UUID)
        try:
            user_id_val = int(user_id)
        except (ValueError, TypeError):
            user_id_val = user_id

        payload = {
            "user_id": user_id_val,
            "image_file": original_image_base64,
            "original_image": original_image_base64,
            "heatmap_image": _normalize_base64_image(result.get("gradcam_heatmap"), "image/jpeg"),
            "overlay_image": _normalize_base64_image(result.get("gradcam_image"), "image/jpeg"),
            "segmentation_image": _normalize_base64_image(result.get("segmentation_mask"), "image/png"),
            "feature_type": result.get("model_type"),
            "organ_type": _infer_organ_type(result),
            "prediction_label": _build_prediction_label(result),
            "confidence_score": _build_confidence_score(result),
            "description": result.get("ai_description"),
            "created_at": __import__("datetime").datetime.utcnow().isoformat(),
        }

        print(f"[Repo] Inserting analysis for user {user_id_val}...")
        response = supabase.table("tbl_history").insert(payload).execute()
        inserted = response.data[0] if response.data else payload

        enriched_result = dict(result)
        enriched_result["history_id"] = inserted.get("id")
        return enriched_result

    @staticmethod
    def get_history(user_id: int):
        response = (
            supabase.table("tbl_history")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return [_to_history_item(row) for row in (response.data or [])]

    @staticmethod
    def filter_history(user_id: int, query: str):
        keyword = str(query or "").strip().lower()
        query_builder = (
            supabase.table("tbl_history")
            .select("*")
            .eq("user_id", user_id)
        )

        if "classification".startswith(keyword):
            query_builder = query_builder.eq("feature_type", "classification")
        elif "segmentation".startswith(keyword):
            query_builder = query_builder.eq("feature_type", "segmentation")
        elif keyword:
            like_pattern = f"%{keyword}%"
            query_builder = query_builder.or_(
                ",".join([
                    f"prediction_label.ilike.{like_pattern}",
                    f"description.ilike.{like_pattern}",
                    f"feature_type.ilike.{like_pattern}",
                    f"organ_type.ilike.{like_pattern}",
                ])
            )

        response = query_builder.order("created_at", desc=True).execute()
        return [_to_history_item(row) for row in (response.data or [])]

    @staticmethod
    def delete_history_item(user_id: int, history_id: int):
        response = (
            supabase.table("tbl_history")
            .delete()
            .eq("id", history_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(response.data)


AnalysisRepository = ResultRepository