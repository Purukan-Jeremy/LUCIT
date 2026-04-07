class ResultRepository:
    _history = []

    @staticmethod
    def store_analysis_result(result: dict):
        if isinstance(result, dict):
            ResultRepository._history.insert(0, dict(result))
        return result

    @staticmethod
    def get_history():
        return list(ResultRepository._history)

    @staticmethod
    def filter_history(query: str):
        keyword = str(query or "").strip().lower()
        if not keyword:
            return ResultRepository.get_history()

        filtered = []
        for item in ResultRepository._history:
            haystacks = [
                str(item.get("prediction", "")).lower(),
                str(item.get("ai_description", "")).lower(),
                str(item.get("status", "")).lower(),
            ]
            if any(keyword in haystack for haystack in haystacks):
                filtered.append(dict(item))

        return filtered


AnalysisRepository = ResultRepository
